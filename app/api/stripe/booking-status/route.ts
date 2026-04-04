import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { finalizeCheckoutSession } from "@/lib/checkoutFinalization";
import { errorResponse, getErrorMessage, logRouteError } from "@/lib/apiErrors";
import { resolveBookingGrossAmount } from "@/lib/paymentMath";
import {
  asRecord,
  asString,
  compactCustomerSummary,
  formatCurrency,
  formatDateLabel,
  formatTimeLabel,
  titleCaseStatus,
  type TransactionConfirmationPayload,
} from "@/lib/transactionConfirmation";

const supabaseAdmin = createAdminClient();

type ReservationLike = {
  id?: string | null;
  status?: string | null;
  payment_status?: string | null;
  check_in_date?: string | null;
  check_out_date?: string | null;
  guest_email?: string | null;
  property_id?: string | null;
  guest_name?: string | null;
  guest_phone?: string | null;
};

function normalizeReservation(reservation: ReservationLike | null) {
  if (!reservation) {
    return null;
  }

  return {
    id: reservation.id,
    status: reservation.status,
    payment_status: reservation.payment_status,
    date: reservation.check_in_date,
    end_date: reservation.check_out_date,
    start_time: null,
    end_time: null,
    customer_email: reservation.guest_email,
    property_id: reservation.property_id,
    guest_name: reservation.guest_name,
    guest_phone: reservation.guest_phone,
    reservation_type: "rental",
  };
}

function buildFinalizingConfirmation({
  sessionId,
  businessName,
  businessSlug,
  businessType,
  transactionType,
}: {
  sessionId: string;
  businessName?: string | null;
  businessSlug?: string | null;
  businessType?: string | null;
  transactionType: "service_booking" | "rental_reservation";
}): TransactionConfirmationPayload {
  return {
    state: "finalizing",
    transactionType,
    headline:
      transactionType === "rental_reservation"
        ? "Finalizing your reservation"
        : "Finalizing your booking",
    message:
      "Your payment was received and we are completing the confirmation record now. This usually resolves within a few seconds.",
    nextStep:
      "Keep this page open while we finish the confirmation. If it does not update shortly, use the reference below when contacting support.",
    reference: sessionId,
    paymentSummary: "Payment received",
    businessName: businessName || null,
    businessSlug: businessSlug || null,
    businessType: businessType || null,
    sections: [],
  };
}

function buildNeedsAttentionConfirmation({
  sessionId,
  businessName,
  businessSlug,
  businessType,
  transactionType,
}: {
  sessionId: string;
  businessName?: string | null;
  businessSlug?: string | null;
  businessType?: string | null;
  transactionType: "service_booking" | "rental_reservation";
}): TransactionConfirmationPayload {
  return {
    state: "needs_attention",
    transactionType,
    headline:
      transactionType === "rental_reservation"
        ? "Reservation needs review"
        : "Booking needs review",
    message:
      "We received your payment, but the final confirmation record still needs manual review.",
    nextStep:
      "Please contact support or the business with your reference so the team can finish the confirmation quickly.",
    reference: sessionId,
    paymentSummary: "Payment received",
    businessName: businessName || null,
    businessSlug: businessSlug || null,
    businessType: businessType || null,
    sections: [],
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return errorResponse({
      status: 400,
      error: "A checkout session reference is required to load this confirmation.",
      code: "BOOKING_STATUS_SESSION_REQUIRED",
      step: "request.validate",
    });
  }

  try {
    const finalization = await finalizeCheckoutSession({
      sessionId,
      source: "booking-status",
    });

    const { data: checkoutIntent } = await supabaseAdmin
      .from("checkout_intents")
      .select("id, kind, business_id, metadata, meta_json, stripe_payment_intent_id")
      .eq("stripe_checkout_session_id", sessionId)
      .maybeSingle();

    const intentMetadata = asRecord(
      checkoutIntent?.metadata ?? checkoutIntent?.meta_json
    );
    const businessId =
      asString(checkoutIntent?.business_id) || asString(intentMetadata.business_id);
    const isRentalFlow =
      asString(intentMetadata.reservation_type) === "rental" ||
      asString(intentMetadata.flow_type) === "rental_reservation";

    const { data: business } = businessId
      ? await supabaseAdmin
          .from("businesses")
          .select("id, name, slug, business_type")
          .eq("id", businessId)
          .maybeSingle()
      : { data: null };

    console.log("[stripe/booking-status]", {
      stage: "domain_resolved",
      sessionId,
      flowType: finalization.flowType,
      businessType: business?.business_type || null,
      sourceTableSelected: isRentalFlow ? "rental_reservations" : "bookings",
    });

    let reservationLookup = await supabaseAdmin
      .from("rental_reservations")
      .select(
        "id, status, payment_status, check_in_date, check_out_date, guest_email, guest_name, guest_phone, property_id"
      )
      .eq("stripe_session_id", sessionId)
      .maybeSingle();

    if (!reservationLookup.data && finalization.bookingId) {
      reservationLookup = await supabaseAdmin
        .from("rental_reservations")
        .select(
          "id, status, payment_status, check_in_date, check_out_date, guest_email, guest_name, guest_phone, property_id"
        )
        .eq("id", finalization.bookingId)
        .maybeSingle();
    }

    if (reservationLookup.error) {
      throw new Error(reservationLookup.error.message);
    }

    const reservation = reservationLookup.data;
    if (reservation) {
      const confirmed =
        reservation.payment_status === "paid" || reservation.status === "confirmed";
      const { data: property } = reservation.property_id
        ? await supabaseAdmin
            .from("property")
            .select("id, name")
            .eq("id", reservation.property_id)
            .maybeSingle()
        : { data: null };
      const customerSummary = compactCustomerSummary({
        name: reservation.guest_name,
        email: reservation.guest_email,
        phone: reservation.guest_phone,
      });
      const confirmation: TransactionConfirmationPayload = {
        state: confirmed ? "confirmed" : "finalizing",
        transactionType: "rental_reservation",
        headline: confirmed ? "Reservation confirmed" : "Finalizing your reservation",
        message: confirmed
          ? "Your stay is secured and the reservation is now confirmed."
          : "Your payment is in and we are finishing the reservation record now.",
        nextStep:
          "The business can now review your stay details and follow up if any arrival instructions are needed.",
        reference: reservation.id || checkoutIntent?.id || sessionId,
        paymentSummary: titleCaseStatus(reservation.payment_status) || "Paid",
        businessName: business?.name || null,
        businessSlug: business?.slug || null,
        businessType: business?.business_type || null,
        sections: [
          {
            title: "Reservation",
            items: [
              { label: "Listing", value: property?.name || "Reserved stay" },
              {
                label: "Check-in",
                value: formatDateLabel(reservation.check_in_date) || reservation.check_in_date,
              },
              {
                label: "Check-out",
                value:
                  formatDateLabel(reservation.check_out_date) || reservation.check_out_date,
              },
            ],
          },
          {
            title: "Guest",
            items: customerSummary
              ? [{ label: "Guest info", value: customerSummary }]
              : [],
          },
        ].filter((section) => section.items.length > 0),
      };

      return NextResponse.json({
        booking: confirmed ? normalizeReservation(reservation) : null,
        status: reservation.status || null,
        payment_status: reservation.payment_status || null,
        finalized: confirmed,
        bookingId: reservation.id || finalization.bookingId || null,
        fallbackReason: confirmed ? null : "reservation_not_confirmed",
        conversation: null,
        confirmation,
      });
    }

    if (isRentalFlow) {
      return NextResponse.json({
        booking: null,
        status: finalization.status || null,
        payment_status: finalization.paymentStatus || null,
        finalized: false,
        bookingId: finalization.bookingId || null,
        fallbackReason: finalization.paid ? "reservation_not_materialized" : "payment_not_finalized",
        conversation: null,
        confirmation: finalization.paid
          ? buildNeedsAttentionConfirmation({
              sessionId,
              businessName: business?.name || null,
              businessSlug: business?.slug || null,
              businessType: business?.business_type || null,
              transactionType: "rental_reservation",
            })
          : buildFinalizingConfirmation({
              sessionId,
              businessName: business?.name || null,
              businessSlug: business?.slug || null,
              businessType: business?.business_type || null,
              transactionType: "rental_reservation",
            }),
      });
    }

    const paymentIntentId = asString(checkoutIntent?.stripe_payment_intent_id);
    let bookingLookup = await supabaseAdmin
      .from("bookings")
      .select(
        "id, business_id, guest_name, guest_email, phone, status, reminder_sent, metadata, duration_minutes, booking_time, customer_name, customer_email, payment_status, stripe_session_id, client_address, payment_intent_id, amount_total, total_amount, platform_fee, date, start_time, end_time, guest_phone"
      )
      .eq("stripe_session_id", sessionId)
      .maybeSingle();

    console.log("[stripe/booking-status]", {
      stage: "service_booking_lookup_attempt",
      sessionId,
      lookupField: "stripe_session_id",
      lookupValue: sessionId,
      paymentIntentId,
      bookingIdHint: finalization.bookingId || null,
      found: Boolean(bookingLookup.data),
    });

    if (!bookingLookup.data && paymentIntentId) {
      bookingLookup = await supabaseAdmin
        .from("bookings")
        .select(
          "id, business_id, guest_name, guest_email, phone, status, reminder_sent, metadata, duration_minutes, booking_time, customer_name, customer_email, payment_status, stripe_session_id, client_address, payment_intent_id, amount_total, total_amount, platform_fee, date, start_time, end_time, guest_phone"
        )
        .eq("payment_intent_id", paymentIntentId)
        .maybeSingle();

      console.log("[stripe/booking-status]", {
        stage: "service_booking_lookup_attempt",
        sessionId,
        lookupField: "payment_intent_id",
        lookupValue: paymentIntentId,
        bookingIdHint: finalization.bookingId || null,
        found: Boolean(bookingLookup.data),
      });
    }

    if (!bookingLookup.data && finalization.bookingId) {
      bookingLookup = await supabaseAdmin
        .from("bookings")
        .select(
          "id, business_id, guest_name, guest_email, phone, status, reminder_sent, metadata, duration_minutes, booking_time, customer_name, customer_email, payment_status, stripe_session_id, client_address, payment_intent_id, amount_total, total_amount, platform_fee, date, start_time, end_time, guest_phone"
        )
        .eq("id", finalization.bookingId)
        .maybeSingle();

      console.log("[stripe/booking-status]", {
        stage: "service_booking_lookup_attempt",
        sessionId,
        lookupField: "id",
        lookupValue: finalization.bookingId,
        paymentIntentId,
        found: Boolean(bookingLookup.data),
      });
    }

    if (bookingLookup.error) {
      throw new Error(bookingLookup.error.message);
    }

    const booking = bookingLookup.data;

    console.log("[stripe/booking-status]", {
      stage: "service_booking_lookup",
      sessionId,
      flowType: finalization.flowType,
      businessType: business?.business_type || null,
      sourceTableSelected: "bookings",
      businessId,
      serviceId: asString(intentMetadata.service_id),
      lookupFieldsUsed: [
        "stripe_session_id",
        ...(paymentIntentId ? ["payment_intent_id"] : []),
        ...(finalization.bookingId ? ["id"] : []),
      ],
      bookingId: booking?.id || finalization.bookingId || null,
      finalBookingStatus: booking?.status || finalization.orderStatus || null,
      paymentStatus: booking?.payment_status || finalization.paymentStatus || null,
      fallbackUsed: !booking,
    });
    const confirmed =
      booking?.payment_status === "paid" || booking?.status === "confirmed";
    const serviceId = asString(intentMetadata.service_id);
    const { data: service } = serviceId
      ? await supabaseAdmin
          .from("services")
          .select("id, name")
          .eq("id", serviceId)
          .maybeSingle()
      : { data: null };
    const customerSummary = compactCustomerSummary({
      name:
        booking?.guest_name ||
        booking?.customer_name ||
        asString(intentMetadata.guest_name) ||
        asString(intentMetadata.customer_name),
      email:
        booking?.guest_email ||
        booking?.customer_email ||
        asString(intentMetadata.guest_email) ||
        asString(intentMetadata.customer_email),
      phone:
        booking?.guest_phone ||
        booking?.phone ||
        asString(intentMetadata.guest_phone) ||
        asString(intentMetadata.customer_phone),
    });
    const timeWindow = [formatTimeLabel(booking?.start_time), formatTimeLabel(booking?.end_time)]
      .filter(Boolean)
      .join(" - ");
    const serviceLocation =
      booking?.client_address ||
      (asString(intentMetadata.service_mode) === "remote" ? "Remote service" : null);
    const confirmation: TransactionConfirmationPayload = booking
      ? {
          state: confirmed ? "confirmed" : "finalizing",
          transactionType: "service_booking",
          headline: confirmed ? "Booking confirmed" : "Finalizing your booking",
          message: confirmed
            ? "Your service booking is confirmed and saved."
            : "Your payment is in and we are finishing the booking record now.",
          nextStep:
            asString(intentMetadata.service_mode) === "remote"
              ? "The business can now follow up with remote session details if needed."
              : "The business can now prepare for your scheduled service and contact you if anything else is needed.",
          reference: booking.id || checkoutIntent?.id || sessionId,
          paymentSummary:
            titleCaseStatus(booking.payment_status) ||
            titleCaseStatus(finalization.paymentStatus) ||
            "Paid",
          businessName: business?.name || null,
          businessSlug: business?.slug || null,
          businessType: business?.business_type || null,
          sections: [
            {
              title: "Booking",
              items: [
                { label: "Service", value: service?.name || "Scheduled service" },
                {
                  label: "Date",
                  value: formatDateLabel(booking.date) || booking.date || "Scheduled",
                },
                ...(timeWindow ? [{ label: "Time", value: timeWindow }] : []),
                ...(serviceLocation
                  ? [{ label: "Location", value: serviceLocation }]
                  : []),
              ],
            },
            {
              title: "Customer",
              items: customerSummary
                ? [{ label: "Identity", value: customerSummary }]
                : [],
            },
            {
              title: "Payment",
              items: [
                ...(booking.amount_total ?? booking.total_amount
                  ? [
                      {
                        label: "Total paid",
                        value:
                          formatCurrency(
                            resolveBookingGrossAmount({
                              amount_total: booking.amount_total,
                              total_amount: booking.total_amount,
                            })
                          ) || "Paid",
                      },
                    ]
                  : []),
                {
                  label: "Payment status",
                  value:
                    titleCaseStatus(booking.payment_status) ||
                    titleCaseStatus(finalization.paymentStatus) ||
                    "Paid",
                },
              ],
            },
          ].filter((section) => section.items.length > 0),
        }
      : buildFinalizingConfirmation({
          sessionId,
          businessName: business?.name || null,
          businessSlug: business?.slug || null,
          businessType: business?.business_type || null,
          transactionType: "service_booking",
        });

    const finalized = Boolean(booking && confirmed);
    const fallbackReason = finalized
      ? null
      : finalization.paid
        ? "service_booking_not_materialized"
        : "payment_not_finalized";

    if (booking) {
      console.log("[stripe/booking-status]", {
        stage: "service_booking_lookup_success",
        sessionId,
        flowType: finalization.flowType,
        businessType: business?.business_type || null,
        sourceTableSelected: "bookings",
        bookingId: booking.id || null,
        lookupFieldsUsed: [
          booking.stripe_session_id === sessionId ? "stripe_session_id" : null,
          booking.payment_intent_id === paymentIntentId ? "payment_intent_id" : null,
          booking.id === finalization.bookingId ? "id" : null,
        ].filter(Boolean),
        finalBookingStatus: booking.status || null,
      });
    } else {
      console.log("[stripe/booking-status]", {
        stage: "service_booking_lookup_fallback",
        sessionId,
        flowType: finalization.flowType,
        businessType: business?.business_type || null,
        sourceTableSelected: "bookings",
        paymentIntentId,
        bookingIdHint: finalization.bookingId || null,
        fallbackReason,
      });
    }

    console.log("[stripe/booking-status]", {
      stage: "service_booking_response",
      sessionId,
      flowType: finalization.flowType,
      businessId,
      serviceId: asString(intentMetadata.service_id),
      customerEmail:
        booking?.guest_email ||
        booking?.customer_email ||
        asString(intentMetadata.guest_email) ||
        asString(intentMetadata.customer_email),
      bookingId: booking?.id || finalization.bookingId || null,
      finalized,
      fallbackReason,
      returnedState: finalized ? "confirmed" : confirmation.state,
    });

    return NextResponse.json({
      booking: confirmed ? booking : null,
      status: booking?.status || finalization.status || null,
      payment_status: booking?.payment_status || finalization.paymentStatus || null,
      finalized,
      bookingId: booking?.id || finalization.bookingId || null,
      fallbackReason,
      conversation: null,
      confirmation,
    });
  } catch (err: unknown) {
    logRouteError("stripe/booking-status", {
      step: "finalization.load",
      code: "BOOKING_STATUS_LOOKUP_FAILED",
      message: getErrorMessage(err, "Booking status lookup failed"),
      error: err,
      extra: {
        sessionId,
      },
    });

    return NextResponse.json({
      ok: false,
      error: "We couldn't confirm this booking yet.",
      code: "BOOKING_STATUS_LOOKUP_FAILED",
      step: "finalization.load",
      booking: null,
      status: "error",
      payment_status: null,
      finalized: false,
      bookingId: null,
      fallbackReason: "finalization_failed",
      conversation: null,
      confirmation: buildNeedsAttentionConfirmation({
        sessionId,
        transactionType: "service_booking",
      }),
    }, { status: 500 });
  }
}
