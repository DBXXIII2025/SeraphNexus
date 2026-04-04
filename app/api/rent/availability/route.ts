import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  buildUnavailableDates,
  getTodayDate,
  isActiveRentalBooking,
  normalizeDate,
  overlapsBlockedDateRange,
  overlapsReservationDateRange,
} from "@/lib/rentalAvailability";
import { errorResponse, getErrorMessage, logRouteError } from "@/lib/apiErrors";
import type { Database } from "@/types/database";
import { applyVisibleFilter } from "@/lib/transactionVisibility";

export const runtime = "nodejs";

type RentalBlockAvailabilityRow = Pick<
  Database["public"]["Tables"]["rental_availability_blocks"]["Row"],
  "id" | "start_date" | "end_date" | "reason" | "property_id"
>;
type PropertyScopeRow = Pick<
  Database["public"]["Tables"]["property"]["Row"],
  "id" | "business_id" | "name"
>;

function getErrorDetails(error: {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
} | null | undefined) {
  if (!error) {
    return null;
  }

  return {
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
  };
}

function isUuid(value: string | null) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value
      )
  );
}

export async function GET(req: Request) {
  let stage = "init";

  try {
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get("businessId");
    const propertyId = searchParams.get("propertyId");
    const rawStartDate = searchParams.get("startDate");
    const rawEndDate = searchParams.get("endDate");
    const startDate = normalizeDate(rawStartDate);
    const endDate = normalizeDate(rawEndDate);
    const timeZone = searchParams.get("tz") || undefined;

    console.log("[rent/availability] request", {
      businessId,
      propertyId,
      startDate: rawStartDate,
      endDate: rawEndDate,
      timeZone: timeZone || null,
    });

    if (!businessId || !propertyId || !isUuid(businessId) || !isUuid(propertyId)) {
      return errorResponse({
        status: 400,
        error: "Business and property are required to check rental availability.",
        code: "RENTAL_AVAILABILITY_INVALID_REQUEST",
        step,
        extra: {
          available: false,
          reason: "invalid_request",
        },
      });
    }

    const supabase = createAdminClient();
    stage = "property-scope";

    const { data: property, error: propertyError } = await supabase
      .from("property")
      .select("id, business_id, name")
      .eq("id", propertyId)
      .eq("business_id", businessId)
      .maybeSingle<PropertyScopeRow>();

    if (propertyError) {
      console.error("[rent/availability] property lookup failed", {
        businessId,
        propertyId,
        stage,
        propertyError: getErrorDetails(propertyError),
      });

      return NextResponse.json(
        {
          ok: false,
          available: false,
          reason: "load_failed",
          error: "We couldn't load this rental property right now.",
          code: "RENTAL_PROPERTY_SCOPE_FAILED",
          step,
        },
        { status: 500 }
      );
    }

    if (!property) {
      return NextResponse.json(
        {
          ok: false,
          available: false,
          reason: "property_not_found",
          error: "This rental listing is unavailable.",
          code: "RENTAL_PROPERTY_NOT_FOUND",
          step,
        },
        { status: 404 }
      );
    }

    stage = "availability-load";
    const [{ data: reservations, error: reservationsError }, { data: blocks, error: blocksError }] =
      await Promise.all([
        applyVisibleFilter(
          supabase
            .from("rental_reservations")
            .select(
              "id, business_id, property_id, status, payment_status, guest_name, guest_email, guest_phone, check_in_date, check_out_date, stripe_session_id, payment_intent_id, amount_total, platform_fee, metadata"
            )
            .eq("business_id", businessId)
            .eq("property_id", propertyId)
            .order("check_in_date", { ascending: true })
        ),
        supabase
          .from("rental_availability_blocks")
          .select("id, property_id, start_date, end_date, reason")
          .eq("business_id", businessId)
          .eq("property_id", propertyId)
          .order("start_date", { ascending: true }),
      ]);

    if (reservationsError) {
      console.error("[rent/availability] reservation lookup failed", {
        businessId,
        propertyId,
        stage,
        reservationsError: getErrorDetails(reservationsError),
      });

      return NextResponse.json(
        {
          ok: false,
          available: false,
          reason: "load_failed",
          error: "We couldn't load rental availability right now.",
          code: "RENTAL_RESERVATIONS_READ_FAILED",
          step,
        },
        { status: 500 }
      );
    }

    if (blocksError) {
      console.error("[rent/availability] block lookup failed", {
        businessId,
        propertyId,
        stage,
        blocksError: getErrorDetails(blocksError),
      });

      return NextResponse.json(
        {
          ok: false,
          available: false,
          reason: "load_failed",
          error: "We couldn't load rental availability right now.",
          code: "RENTAL_BLOCKS_READ_FAILED",
          step,
        },
        { status: 500 }
      );
    }

    const activeReservations = (reservations || []).filter(isActiveRentalBooking);
    const blockRows: RentalBlockAvailabilityRow[] = blocks || [];
    const unavailableDates = [
      ...new Set([
        ...buildUnavailableDates(blockRows),
        ...buildUnavailableDates(activeReservations),
      ]),
    ].sort();

    console.log("[rent/availability] loaded counts", {
      businessId,
      propertyId,
      reservationCount: reservations?.length || 0,
      activeReservationCount: activeReservations.length,
      blockCount: blockRows.length,
    });

    if (!rawStartDate || !rawEndDate) {
      return NextResponse.json({
        ok: true,
        available: true,
        unavailableDates,
        blocks: blockRows,
        reservations: activeReservations,
      });
    }

    if (!startDate || !endDate || endDate <= startDate) {
      return NextResponse.json(
        {
          ok: false,
          available: false,
          reason: "invalid_request",
          error: "Enter a valid check-in and check-out date.",
          code: "RENTAL_INVALID_STAY_RANGE",
          step,
        },
        { status: 400 }
      );
    }

    const todayDate = getTodayDate(timeZone);
    if (startDate < todayDate) {
      console.log("[rent/availability] rejected past stay start", {
        businessId,
        propertyId,
        requestedCheckIn: startDate,
        requestedCheckOut: endDate,
        todayDate,
      });

      return NextResponse.json(
        {
          ok: true,
          available: false,
          reason: "past-start-date",
          unavailableDates,
          blocks: blockRows,
          reservations: activeReservations,
        },
        { status: 200 }
      );
    }

    const blockConflicts = blockRows.filter((block) => {
      if (!block.start_date || !block.end_date) {
        return false;
      }

      return overlapsBlockedDateRange(
        block.start_date,
        block.end_date,
        startDate,
        endDate
      );
    });

    console.log("[rent/availability] block overlap matches", {
      businessId,
      propertyId,
      requestedCheckIn: startDate,
      requestedCheckOut: endDate,
      overlapCount: blockConflicts.length,
      overlapIds: blockConflicts.map((block) => block.id),
    });

    if (blockConflicts.length > 0) {
      return NextResponse.json({
        ok: true,
        available: false,
        reason: "blocked-dates",
        unavailableDates,
        blocks: blockRows,
        reservations: activeReservations,
      });
    }

    const reservationConflicts = activeReservations.filter((reservation) => {
      if (!reservation.check_in_date || !reservation.check_out_date) {
        return false;
      }

      return overlapsReservationDateRange(
        reservation.check_in_date,
        reservation.check_out_date,
        startDate,
        endDate
      );
    });

    console.log("[rent/availability] reservation overlap matches", {
      businessId,
      propertyId,
      requestedCheckIn: startDate,
      requestedCheckOut: endDate,
      overlapCount: reservationConflicts.length,
      overlaps: reservationConflicts.map((reservation) => ({
        id: reservation.id,
        status: reservation.status,
        paymentStatus: reservation.payment_status,
        checkInDate: reservation.check_in_date,
        checkOutDate: reservation.check_out_date,
      })),
    });

    if (reservationConflicts.length > 0) {
      return NextResponse.json({
        ok: true,
        available: false,
        reason: "existing-booking",
        unavailableDates,
        blocks: blockRows,
        reservations: activeReservations,
      });
    }

    console.log("[rent/availability] available", {
      businessId,
      propertyId,
      requestedCheckIn: startDate,
      requestedCheckOut: endDate,
    });

    return NextResponse.json({
      ok: true,
      available: true,
      unavailableDates,
      blocks: blockRows,
      reservations: activeReservations,
    });
  } catch (err: unknown) {
    logRouteError("rent/availability", {
      step: stage,
      code: "RENTAL_AVAILABILITY_UNEXPECTED",
      message: getErrorMessage(err, "Unexpected rental availability failure"),
      status: 500,
      error: err,
    });

    return errorResponse({
      status: 500,
      error: "We couldn't load rental availability right now.",
      code: "RENTAL_AVAILABILITY_UNEXPECTED",
      step: stage,
      extra: {
        available: false,
        reason: "load_failed",
      },
    });
  }
}
