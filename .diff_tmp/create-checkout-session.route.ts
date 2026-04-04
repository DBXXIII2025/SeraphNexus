import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import {
  calculateDemandScore,
  calculateSlotPrice,
  shouldApplyGapDiscount,
} from "@/lib/pricing/engine";

function getBaseUrl(req: Request) {
  return process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin;
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

export async function POST(req: Request) {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { business_id, date, start_time, end_time, customer_email } = body || {};

    if (!business_id || !date || !start_time || !end_time || !customer_email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: business } = await supabase
      .from("businesses")
      .select("id, name, stripe_account_id, plan")
      .eq("id", business_id)
      .single();

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    if (!business.stripe_account_id) {
      return NextResponse.json(
        { error: "Business has not connected Stripe" },
        { status: 400 }
      );
    }

    const { data: bookings } = await supabase
      .from("bookings")
      .select("start_time, end_time, status")
      .eq("business_id", business_id)
      .eq("date", date)
      .neq("status", "cancelled");

    const hasOverlap = (bookings || []).some((b: any) => {
      if (!b.start_time || !b.end_time) return false;
      return overlaps(start_time, end_time, b.start_time, b.end_time);
    });

    if (hasOverlap) {
      return NextResponse.json({ error: "Slot already booked" }, { status: 409 });
    }

    const recentStart = new Date(date);
    recentStart.setDate(recentStart.getDate() - 30);
    const recentStartStr = recentStart.toISOString().slice(0, 10);

    const { data: recentBookings } = await supabase
      .from("bookings")
      .select("date, start_time, end_time, created_at, status")
      .eq("business_id", business_id)
      .gte("date", recentStartStr)
      .lte("date", date)
      .neq("status", "cancelled");

    const { data: pricingRule } = await supabase
      .from("pricing_rules")
      .select("base_price, peak_multiplier, low_demand_discount")
      .eq("business_id", business_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const defaultRule = {
      base_price: 100,
      peak_multiplier: 1.25,
      low_demand_discount: 0.15,
    };

    const rule = pricingRule || defaultRule;

    const demandScore = calculateDemandScore({
      slot: { date, start: start_time, end: end_time },
      allBookings: recentBookings || [],
      recentBookings: (recentBookings || []).filter((b: any) => {
        if (!b.created_at) return false;
        const created = new Date(b.created_at);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);
        return created >= cutoff;
      }),
    });

    const gapDiscount = shouldApplyGapDiscount({
      slot: { date, start: start_time, end: end_time },
      bookingsForDate: bookings || [],
    });

    const price = calculateSlotPrice({
      slot: { date, start: start_time, end: end_time },
      demandScore,
      rule,
      gapDiscount,
    });

    const priceAdjustment = price - rule.base_price;

    let feePercent = 0.1;
    if (business.plan === "growth") feePercent = 0.05;
    if (business.plan === "pro") feePercent = 0.02;

    const applicationFee = Math.round(price * 100 * feePercent);
    const baseUrl = getBaseUrl(req);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email,
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(price * 100),
            product_data: {
              name: `${business.name || "Booking"} - ${date}`,
              description: `${start_time} - ${end_time}`,
            },
          },
        },
      ],
      success_url: `${baseUrl}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/booking-cancel`,
      payment_intent_data: {
        application_fee_amount: applicationFee,
        transfer_data: {
          destination: business.stripe_account_id,
        },
      },
      metadata: {
        kind: "slot_booking",
        business_id,
        date,
        start_time,
        end_time,
        customer_email,
        price: String(price),
        demand_score: String(demandScore),
        price_adjustment: String(priceAdjustment),
      },
    });

    const adminClient = createAdminClient();
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
          recent_booking_count_7d: (recentBookings || []).filter((b: any) => {
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
  } catch (err: any) {
    console.error("CREATE CHECKOUT ERROR:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
