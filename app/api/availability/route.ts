import { createClient } from "@/lib/supabase/server";
import { generateSlots } from "@/lib/availability/getSlots";
import { getZonedParts, makeZonedDate } from "@/lib/timezone";
import {
  calculateDemandScore,
  calculateSlotPrice,
  shouldApplyGapDiscount,
  type PricingRule,
} from "@/lib/pricing/engine";
import { errorResponse, logRouteError } from "@/lib/apiErrors";
import { applyVisibleFilter } from "@/lib/transactionVisibility";

type SlotRow = {
  start: string;
  end: string;
  price: number;
  base_price: number;
  price_adjustment: number;
  pricing_adjustment_applied: boolean;
  demand_score: number;
  scheduling_model?: "strict_slot" | "flexible_date";
  is_flexible?: boolean;
};

type BookingRow = {
  start_time: string | null;
  end_time: string | null;
  status?: string | null;
  created_at?: string | null;
};

type AvailabilityRow = {
  start_time: string | null;
  end_time: string | null;
};

type ServiceRow = {
  id: string;
  duration: number | null;
  price: number | null;
};

function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map((v) => Number(v));
  return h * 60 + (m || 0);
}

function overlaps(startA: string, endA: string, startB: string, endB: string) {
  return (
    timeToMinutes(startA) < timeToMinutes(endB) &&
    timeToMinutes(endA) > timeToMinutes(startB)
  );
}

function isValidTimeRange(
  startTime: string | null | undefined,
  endTime: string | null | undefined
) {
  if (!startTime || !endTime) {
    return false;
  }

  return timeToMinutes(endTime) > timeToMinutes(startTime);
}

function getTodayDateInTimeZone(timeZone: string) {
  const parts = getZonedParts(new Date(), timeZone);
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

function logAvailabilityDecision(details: Record<string, unknown>) {
  console.log("[availability/service]", details);
}

export async function GET(req: Request) {
  let step = "request.parse";

  try {
    const { searchParams } = new URL(req.url);

    const businessId = searchParams.get("businessId");
    const date = searchParams.get("date");
    const tzParam = searchParams.get("tz") || "UTC";
    const serviceId = searchParams.get("serviceId");

    if (!businessId || !date) {
      return errorResponse({
        status: 400,
        error: "Business and date are required to load availability.",
        code: "AVAILABILITY_PARAMS_REQUIRED",
        step,
      });
    }

    const supabase = await createClient();

    let timeZone = "UTC";
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tzParam }).format();
      timeZone = tzParam;
    } catch {
      timeZone = "UTC";
    }

    const todayDate = getTodayDateInTimeZone(timeZone);
    if (date < todayDate) {
      logAvailabilityDecision({
        businessId,
        dateRequested: date,
        timezone: timeZone,
        businessHoursFound: false,
        serviceDurationFound: false,
        pricingRulesQueried: true,
        pricingRulesMatched: 0,
        appliedAmountAdjustment: false,
        appliedPercentageAdjustment: false,
        fallbackPricingUsed: true,
        slotsGenerated: 0,
        existingBookingsBlockedAllSlots: false,
        finalReason: "past_date",
      });

      return Response.json({
        slots: [],
        availabilityConfigured: true,
        schedulingModel: "strict_slot",
        reason: "past_date",
        timeZone,
      });
    }

    step = "business.read";
    const day = makeZonedDate(date, 12, 0, timeZone).getUTCDay();

    const [
      { data: business, error: businessError },
      { data: availability, error: availabilityError },
      { data: bookings, error: bookingsError },
      pricingRulesLookup,
      serviceLookup,
    ] = await Promise.all([
      supabase
        .from("businesses")
        .select("id, business_type")
        .eq("id", businessId)
        .maybeSingle(),
      supabase
        .from("availability")
        .select("start_time, end_time")
        .eq("business_id", businessId)
        .eq("day_of_week", day),
      applyVisibleFilter(
        supabase
          .from("bookings")
          .select("start_time, end_time, status, created_at")
          .eq("business_id", businessId)
          .eq("date", date)
      ),
      supabase
        .from("pricing_rules")
        .select(
          "id, business_id, service_id, day_of_week, start_time, end_time, active, priority, rule_type, amount, percentage, metadata, created_at, updated_at"
        )
        .eq("business_id", businessId)
        .eq("active", true)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false }),
      serviceId
        ? supabase
            .from("services")
            .select("id, duration, price")
            .eq("id", serviceId)
            .eq("business_id", businessId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (businessError) {
      logRouteError("availability", {
        step,
        code: "AVAILABILITY_BUSINESS_READ_FAILED",
        message: businessError.message,
        status: 500,
        error: businessError,
        extra: { businessId, date, timeZone },
      });

      return errorResponse({
        status: 500,
        error: "We couldn't load availability right now.",
        code: "AVAILABILITY_BUSINESS_READ_FAILED",
        step,
      });
    }

    if (availabilityError) {
      logRouteError("availability", {
        step: "availability.read",
        code: "AVAILABILITY_READ_FAILED",
        message: availabilityError.message,
        status: 500,
        error: availabilityError,
        extra: { businessId, date, day, timeZone },
      });

      return errorResponse({
        status: 500,
        error: "We couldn't load availability right now.",
        code: "AVAILABILITY_READ_FAILED",
        step: "availability.read",
      });
    }

    if (bookingsError) {
      logRouteError("availability", {
        step: "bookings.read",
        code: "BOOKINGS_READ_FAILED",
        message: bookingsError.message,
        status: 500,
        error: bookingsError,
        extra: { businessId, date, timeZone },
      });

      return errorResponse({
        status: 500,
        error: "We couldn't load availability right now.",
        code: "BOOKINGS_READ_FAILED",
        step: "bookings.read",
      });
    }

    if (pricingRulesLookup.error) {
      logRouteError("availability", {
        step: "pricing_rules.read",
        code: "PRICING_RULES_READ_FAILED",
        message: pricingRulesLookup.error.message,
        status: 500,
        error: pricingRulesLookup.error,
        extra: { businessId, date, serviceId, timeZone },
      });

      return errorResponse({
        status: 500,
        error: "We couldn't calculate availability right now.",
        code: "PRICING_RULES_READ_FAILED",
        step: "pricing_rules.read",
      });
    }

    const pricingRules = ((pricingRulesLookup.data || []) as PricingRule[]).filter(
      (rule) => rule.active !== false
    );

    console.log("[availability/service]", {
      stage: "pricing_rules_result",
      businessId,
      dateRequested: date,
      serviceId,
      pricingRulesQueried: true,
      pricingRulesMatched: pricingRules.length,
      fallbackPricingUsed: pricingRules.length === 0,
    });

    const service = (serviceLookup?.data || null) as ServiceRow | null;
    if (serviceId && !service?.id) {
      logAvailabilityDecision({
        businessId,
        dateRequested: date,
        timezone: timeZone,
        sourceRecordType: "services",
        sourceRecordCount: 0,
        serviceId,
        rejectedSelection: true,
        rejectionReason: "invalid_service_id",
      });

      return errorResponse({
        status: 404,
        error: "The selected service is unavailable.",
        code: "AVAILABILITY_SERVICE_UNAVAILABLE",
        step: "service.read",
      });
    }

    const serviceDuration = Number(service?.duration || 0);
    const servicePrice = Number(service?.price || 0);
    console.log("[availability/service]", {
      stage: "selection_source_records",
      businessId,
      dateRequested: date,
      sourceRecordType: "services",
      sourceRecordCount: service?.id ? 1 : 0,
      serviceId: service?.id || serviceId || null,
      baseServicePrice: servicePrice > 0 ? servicePrice : null,
      serviceDurationFound: serviceDuration > 0,
    });
    const validAvailabilityBlocks = ((availability || []) as AvailabilityRow[]).filter(
      (block) => isValidTimeRange(block.start_time, block.end_time)
    );
    const hasBusinessHours = validAvailabilityBlocks.length > 0;

    const slotDurationMinutes = serviceDuration > 0 ? serviceDuration : 60;
    const fallbackBlocks =
      (business?.business_type || "").toLowerCase() === "service" && !hasBusinessHours
        ? [{ start_time: "09:00", end_time: "17:00" }]
        : [];
    const blocksToUse =
      validAvailabilityBlocks.length > 0
        ? validAvailabilityBlocks
        : fallbackBlocks;

    if (blocksToUse.length === 0) {
      logAvailabilityDecision({
        businessId,
        dateRequested: date,
        timezone: timeZone,
        businessHoursFound: false,
        serviceDurationFound: serviceDuration > 0,
        pricingRulesQueried: true,
        pricingRulesMatched: pricingRules.length,
        appliedAmountAdjustment: false,
        appliedPercentageAdjustment: false,
        fallbackPricingUsed: true,
        slotsGenerated: 0,
        existingBookingsBlockedAllSlots: false,
        finalReason: "no_business_hours",
      });

      return Response.json({
        slots: [],
        availabilityConfigured: false,
        schedulingModel: "strict_slot",
        reason: "no_business_hours",
        timeZone,
      });
    }

    const allSlots: Array<{ start: string; end: string }> = [];

    for (const block of blocksToUse) {
      const slots = generateSlots({
        start: block.start_time as string,
        end: block.end_time as string,
        durationMinutes: slotDurationMinutes,
      });

      allSlots.push(...slots);
    }

    const bookingRows = (bookings || []) as BookingRow[];
    const filtered = allSlots.filter((slot) => {
      const conflict = bookingRows.some((booking) => {
        if (!booking.start_time || !booking.end_time) {
          return false;
        }

        return overlaps(slot.start, slot.end, booking.start_time, booking.end_time);
      });

      if (conflict) {
        console.log("[availability] slot rejected", {
          businessId,
          date,
          slotStart: slot.start,
          slotEnd: slot.end,
          reason: "overlap",
        });
      }

      return !conflict;
    });

    const recentBookings = bookingRows.filter((booking) => {
      if (!booking.created_at) return false;
      const created = new Date(booking.created_at);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      return created >= cutoff;
    });

    const slotsWithPricing: SlotRow[] = [];
    let appliedAmountAdjustment = false;
    let appliedPercentageAdjustment = false;
    let matchedRuleCount = 0;

    for (const slot of filtered) {
      const demandScore = calculateDemandScore({
        slot: { date, start: slot.start, end: slot.end },
        allBookings: bookingRows,
        recentBookings,
      });

      const gapDiscount = shouldApplyGapDiscount({
        slot,
        bookingsForDate: bookingRows,
      });

      const pricing = calculateSlotPrice({
        slot,
        demandScore,
        gapDiscount,
        basePrice: servicePrice > 0 ? servicePrice : 0,
        pricingRules,
        serviceId,
        dayOfWeek: day,
      });

      appliedAmountAdjustment =
        appliedAmountAdjustment || pricing.appliedAmountAdjustment;
      appliedPercentageAdjustment =
        appliedPercentageAdjustment || pricing.appliedPercentageAdjustment;
      matchedRuleCount = Math.max(matchedRuleCount, pricing.matchedRuleCount);

      step = "slot_pricing.upsert";
      const { error: slotPricingError } = await supabase.from("slot_pricing").upsert(
        {
          business_id: businessId,
          date,
          start_time: slot.start,
          end_time: slot.end,
          demand_score: demandScore,
          price: pricing.price,
          price_adjustment: pricing.priceAdjustment,
        },
        {
          onConflict: "business_id,date,start_time,end_time",
        }
      );

      if (slotPricingError) {
        logRouteError("availability", {
          step,
          code: "SLOT_PRICING_UPSERT_FAILED",
          message: slotPricingError.message,
          status: 500,
          error: slotPricingError,
          extra: {
            businessId,
            date,
            startTime: slot.start,
            endTime: slot.end,
          },
        });
      }

      slotsWithPricing.push({
        ...slot,
        price: pricing.price,
        base_price: servicePrice > 0 ? servicePrice : pricing.price,
        price_adjustment: pricing.priceAdjustment,
        pricing_adjustment_applied: pricing.priceAdjustment !== 0,
        demand_score: demandScore,
        scheduling_model: "strict_slot",
        is_flexible: false,
      });
    }

    logAvailabilityDecision({
      businessId,
      dateRequested: date,
      timezone: timeZone,
      businessHoursFound: hasBusinessHours,
      serviceDurationFound: serviceDuration > 0,
      pricingRulesQueried: true,
      pricingRulesMatched: matchedRuleCount,
      appliedAmountAdjustment,
      appliedPercentageAdjustment,
      fallbackPricingUsed: matchedRuleCount === 0,
      slotsGenerated: allSlots.length,
      existingBookingsBlockedAllSlots: allSlots.length > 0 && filtered.length === 0,
      finalReason:
        filtered.length > 0
          ? "slots_available"
          : allSlots.length === 0
            ? "no_slots_generated"
            : "all_slots_blocked",
    });

    return Response.json({
      slots: slotsWithPricing,
      availabilityConfigured: hasBusinessHours,
      schedulingModel: "strict_slot",
      reason:
        slotsWithPricing.length > 0
          ? "slots_available"
          : allSlots.length === 0
            ? "no_slots_generated"
            : "all_slots_blocked",
      timeZone,
    });
  } catch (error: unknown) {
    logRouteError("availability", {
      step,
      code: "AVAILABILITY_UNEXPECTED",
      message: "Unexpected availability failure",
      status: 500,
      error,
    });

    return errorResponse({
      status: 500,
      error: "We couldn't load availability right now.",
      code: "AVAILABILITY_UNEXPECTED",
      step,
    });
  }
}
