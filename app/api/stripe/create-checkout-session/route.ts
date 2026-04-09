import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/appUrl";
import { hasOperationalAccess } from "@/lib/accessPlan";
import { resolveAccessPlanForBusiness } from "@/lib/accessGrants";
import { getFeatureGate, getUsageLimitResult } from "@/lib/planEnforcement";
import { loadBusinessUsageSnapshot } from "@/lib/planUsageServer";
import { stripe } from "@/lib/stripe";
import { getPublicPath } from "@/lib/businessModules";
import { getPlatformFeePercent } from "@/lib/planConfig";
import {
  calculateDemandScore,
  calculateSlotPrice,
  shouldApplyGapDiscount,
  type PricingRule,
} from "@/lib/pricing/engine";
import { trackLeadEventServer } from "@/lib/leads.server";
import { errorResponse, getErrorMessage, logRouteError } from "@/lib/apiErrors";
import { applyVisibleFilter } from "@/lib/transactionVisibility";

type BookingWindowRow = {
  date?: string | null;
  start_time: string | null;
  end_time: string | null;
  created_at?: string | null;
  status?: string | null;
};

function getBaseUrl(req: Request) {
  return getAppUrl(req);
}

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

function getPublicCancelUrl(baseUrl: string, businessType: string | null | undefined, slug: string | null | undefined) {
  if (slug) {
    return `${baseUrl}${getPublicPath(businessType, slug)}`;
  }

  return baseUrl;
}

function normalizeUsdAmountToCents(value: number) {
  return Math.round(value * 100);
}

export async function POST(req: Request) {
  let step = "request.parse";

  try {
    const body = await req.json();
    const {
      business_id,
      date,
      start_time,
      end_time,
      customer_email,
      customer_name,
      phone,
      service_mode,
      client_address,
    } = body || {};

    if (
      !business_id ||
      !date ||
      !start_time ||
      !end_time ||
      !customer_email ||
      !customer_name ||
      !phone
    ) {
      return errorResponse({
        status: 400,
        error: "Business, slot, and customer details are required to start checkout.",
        code: "LEGACY_CHECKOUT_FIELDS_REQUIRED",
        step: "request.validate",
      });
    }

    if (service_mode !== "onsite" && service_mode !== "remote") {
      return errorResponse({
        status: 400,
        error: "Select a valid service mode.",
        code: "LEGACY_CHECKOUT_SERVICE_MODE_INVALID",
        step: "request.validate",
      });
    }

    if (service_mode === "onsite" && !client_address) {
      return errorResponse({
        status: 400,
        error: "Address is required for onsite service bookings.",
        code: "LEGACY_CHECKOUT_ADDRESS_REQUIRED",
        step: "request.validate",
      });
    }

    const supabase = await createClient();
    step = "business.read";

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, owner_id, name, slug, business_type, stripe_account_id, stripe_charges_enabled, plan")
      .eq("id", business_id)
      .single();

    if (businessError) {
      logRouteError("stripe/create-checkout-session", {
        step,
        code: "LEGACY_CHECKOUT_BUSINESS_READ_FAILED",
        message: businessError.message,
        status: 500,
        error: businessError,
        extra: { businessId: business_id },
      });

      return errorResponse({
        status: 500,
        error: "We couldn't start checkout right now.",
        code: "LEGACY_CHECKOUT_BUSINESS_READ_FAILED",
        step,
      });
    }

    if (!business) {
      return errorResponse({
        status: 404,
        error: "This business is unavailable for checkout.",
        code: "LEGACY_CHECKOUT_BUSINESS_NOT_FOUND",
        step,
      });
    }

    if (!business.stripe_account_id) {
      return errorResponse({
        status: 400,
        error: "This business is not ready to accept payments yet.",
        code: "LEGACY_CHECKOUT_STRIPE_NOT_CONNECTED",
        step: "business.stripe.validate",
      });
    }

    if (!business.stripe_charges_enabled) {
      return errorResponse({
        status: 400,
        error: "This business is not ready to accept payments yet.",
        code: "LEGACY_CHECKOUT_STRIPE_CHARGES_DISABLED",
        step: "business.stripe.validate",
      });
    }

    const effectivePlan = await resolveAccessPlanForBusiness({
      business: {
        id: business.id,
        owner_id: business.owner_id || null,
        plan: business.plan,
      },
    });

    if (!hasOperationalAccess(effectivePlan)) {
      return errorResponse({
        status: 403,
        error: "This business is not enabled for checkout yet.",
        code: "LEGACY_CHECKOUT_PLAN_RESTRICTED",
        step: "business.plan.validate",
      });
    }

    const paymentGate = getFeatureGate(effectivePlan, "stripe_payments");
    if (!paymentGate.allowed) {
      return errorResponse({
        status: 403,
        error: paymentGate.message || "Payments are locked on this business plan.",
        code: "LEGACY_CHECKOUT_PAYMENT_LOCKED",
        step: "business.plan.validate",
      });
    }

    const usage = await loadBusinessUsageSnapshot(business.id);
    const transactionLimit = getUsageLimitResult({
      plan: effectivePlan,
      limitKey: "max_transactions",
      current: Number(usage.max_transactions || 0),
      customMessage:
        "Trial businesses are limited to 10 bookings and orders total. Upgrade to Pro or Elite to continue taking transactions.",
    });

    if (!transactionLimit.allowed) {
      return errorResponse({
        status: 403,
        error: transactionLimit.message || "Transaction limit reached.",
        code: "LEGACY_CHECKOUT_TRANSACTION_LIMIT_REACHED",
        step: "business.plan.validate",
      });
    }

    const { data: bookings } = await applyVisibleFilter(
      supabase
        .from("bookings")
        .select("start_time, end_time, status")
        .eq("business_id", business_id)
        .eq("date", date)
    );

    const bookingSlot = {
      date,
      start: start_time,
      end: end_time,
    };

    const bookingsForPricing = ((bookings || []) as BookingWindowRow[]).map((booking) => ({
      ...booking,
      date,
    }));

    const hasOverlap = ((bookings || []) as BookingWindowRow[]).some((b) => {
      if (!b.start_time || !b.end_time) return false;
      return overlaps(start_time, end_time, b.start_time, b.end_time);
    });

    if (hasOverlap) {
      return errorResponse({
        status: 409,
        error: "That time slot is no longer available.",
        code: "LEGACY_CHECKOUT_SLOT_UNAVAILABLE",
        step: "slot.validate",
      });
    }

    const recentStart = new Date(date);
    recentStart.setDate(recentStart.getDate() - 30);
    const recentStartStr = recentStart.toISOString().slice(0, 10);

    const { data: recentBookings } = await applyVisibleFilter(
      supabase
        .from("bookings")
        .select("date, start_time, end_time, created_at, status")
        .eq("business_id", business_id)
        .gte("date", recentStartStr)
        .lte("date", date)
    );

    const { data: pricingRules } = await supabase
      .from("pricing_rules")
      .select(
        "id, business_id, service_id, day_of_week, start_time, end_time, active, priority, rule_type, amount, percentage, metadata, created_at, updated_at"
      )
      .eq("business_id", business_id)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .order("priority", { ascending: false });

    const servicePricingRules = (pricingRules || []) as PricingRule[];

    const demandScore = calculateDemandScore({
      slot: bookingSlot,
      allBookings: bookingsForPricing,
      recentBookings: ((recentBookings || []) as BookingWindowRow[]).filter((b) => {
        if (!b.created_at) return false;
        const created = new Date(b.created_at);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);
        return created >= cutoff;
      }),
    });

    const gapDiscount = shouldApplyGapDiscount({
      slot: bookingSlot,
      bookingsForDate: bookingsForPricing,
    });

    const pricing = calculateSlotPrice({
      slot: bookingSlot,
      demandScore,
      gapDiscount,
      basePrice: 0,
      pricingRules: servicePricingRules,
      dayOfWeek: new Date(`${date}T12:00:00`).getDay(),
    });

    const price = pricing.price;
    const priceAdjustment = pricing.priceAdjustment;
    const currency = "usd";
    const unitAmount = normalizeUsdAmountToCents(price);

    const feePercent = getPlatformFeePercent(effectivePlan);
    const applicationFee = Math.round(unitAmount * feePercent);
    const baseUrl = getBaseUrl(req);

    console.log("[stripe/create-checkout-session] pricing rules:", {
      businessId: business_id,
      matchedRuleCount: pricing.matchedRuleCount,
      appliedAmountAdjustment: pricing.appliedAmountAdjustment,
      appliedPercentageAdjustment: pricing.appliedPercentageAdjustment,
      fallbackPricingUsed: pricing.fallbackUsed,
    });
    console.log("[stripe/create-checkout-session] stripe amount audit", {
      businessId: business_id,
      rawServicePriceFromDb: null,
      computedStripeAmount: price,
      currency,
      finalUnitAmount: unitAmount,
    });

    try {
      await trackLeadEventServer({
        businessId: String(business_id),
        eventType: "booking_started",
        source: "public:legacy-booking",
        visitor_name: String(customer_name),
        visitor_email: String(customer_email),
        visitor_phone: String(phone),
        metadata: {
          date: String(date),
          startTime: String(start_time),
          endTime: String(end_time),
          serviceMode: String(service_mode),
          price,
        },
      });
    } catch (leadError) {
      console.error("[stripe/create-checkout-session] lead tracking failed:", leadError);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email,
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: unitAmount,
            product_data: {
              name: `${business.name || "Booking"} - ${date}`,
              description: `${start_time} - ${end_time}`,
            },
          },
        },
      ],
      success_url: `${baseUrl}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: getPublicCancelUrl(baseUrl, business.business_type, business.slug),
      payment_intent_data: {
        application_fee_amount: applicationFee,
        transfer_data: {
          destination: business.stripe_account_id,
        },
      },
      metadata: {
        kind: "checkout_intent",
        intent_type: "booking",
        flow_type: "service_booking",
        business_id,
        business_type: business.business_type || "service",
        date,
        start_time,
        end_time,
        guest_name: String(customer_name),
        guest_email: customer_email,
        guest_phone: String(phone),
        customer_name: String(customer_name),
        customer_email,
        customer_phone: String(phone),
        service_mode: String(service_mode),
        address_json: JSON.stringify({
          line1: String(client_address || ""),
        }),
        amount_total: String(unitAmount),
        platform_fee: String(applicationFee),
        demand_score: String(demandScore),
        price_adjustment: String(priceAdjustment),
      },
    });

    const adminClient = createAdminClient();
    await adminClient.from("bookings").insert({
      business_id,
      date,
      start_time,
      end_time,
      guest_name: customer_name,
      guest_email: customer_email,
      guest_phone: phone,
      customer_email,
      customer_name,
      phone,
      client_address: client_address || "",
      status: "pending",
      payment_status: "pending",
      stripe_session_id: session.id,
      amount: price,
      amount_total: unitAmount,
      total_amount: unitAmount,
      platform_fee: applicationFee / 100,
      metadata: {
        service_mode,
      },
      demand_score: demandScore,
      price_adjustment: priceAdjustment,
    });

    await adminClient
      .from("slot_pricing")
      .upsert(
        {
          business_id,
          date,
          start_time,
          end_time,
          demand_score: demandScore,
          price,
          price_adjustment: priceAdjustment,
          booking_count_30d: (recentBookings || []).length,
          recent_booking_count_7d: ((recentBookings || []) as BookingWindowRow[]).filter((b) => {
            if (!b.created_at) return false;
            const created = new Date(b.created_at);
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 7);
            return created >= cutoff;
          }).length,
        },
        { onConflict: "business_id,date,start_time,end_time" }
      );

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err: unknown) {
    logRouteError("stripe/create-checkout-session", {
      step,
      code: "LEGACY_CHECKOUT_CREATE_FAILED",
      message: getErrorMessage(err, "Failed to create checkout session"),
      status: 500,
      error: err,
    });

    return errorResponse({
      status: 500,
      error: "We couldn't start checkout right now.",
      code: "LEGACY_CHECKOUT_CREATE_FAILED",
      step,
    });
  }
}
