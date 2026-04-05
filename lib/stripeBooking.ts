import { createAdminClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/appUrl";
import { hasOperationalAccess } from "@/lib/accessPlan";
import { requireEnv } from "@/lib/env";
import { resolveAccessPlanForBusiness } from "@/lib/accessGrants";
import { getFeatureGate, getUsageLimitResult } from "@/lib/planEnforcement";
import { sendBookingEmail, sendBookingSMS } from "@/lib/notify";
import { getPlatformFeePercent } from "@/lib/planConfig";
import { loadBusinessUsageSnapshot } from "@/lib/planUsageServer";
import { stripe } from "@/lib/stripe";

const supabaseAdmin = createAdminClient();

export type CheckoutBookingInput = {
  business_id: string;
  customer_name: string;
  customer_email: string;
  phone: string;
  booking_time: string;
  service_ids: string[];
  client_address?: string;
};

type ServiceRow = {
  id: string;
  name: string;
  duration: number | null;
  price: number | null;
  business_id: string;
};

function requireBaseUrl() {
  const baseUrl = getAppUrl();
  requireEnv("STRIPE_SECRET_KEY");
  return baseUrl;
}

function formatDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatTimeString(date: Date) {
  return date.toISOString().slice(11, 16);
}

function toBookingPlatformFeeValue(applicationFeeCents: number) {
  return Math.max(0, Math.round(applicationFeeCents / 100));
}

export async function createBookingCheckoutSession(
  input: CheckoutBookingInput
) {
  const normalizedInput = {
    ...input,
    client_address: input.client_address || "",
  };

  const serviceIds = [...new Set(normalizedInput.service_ids)];

  const bookingUtc = new Date(normalizedInput.booking_time).toISOString();

  const { data: services } = await supabaseAdmin
    .from("services")
    .select("id, name, duration, price, business_id")
    .in("id", serviceIds);

  const resolvedServices = (services || []) as ServiceRow[];

  const totalDuration = resolvedServices.reduce(
    (sum, s) => sum + (s.duration || 30),
    0
  );

  const totalAmountCents = resolvedServices.reduce(
    (sum, s) => sum + Math.round((s.price || 0) * 100),
    0
  );

  const bookingStart = new Date(bookingUtc);
  const bookingEnd = new Date(bookingStart);
  bookingEnd.setMinutes(bookingEnd.getMinutes() + totalDuration);

  const bookingDate = formatDateString(bookingStart);
  const bookingStartTime = formatTimeString(bookingStart);
  const bookingEndTime = formatTimeString(bookingEnd);

  const baseUrl = requireBaseUrl();

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id, owner_id, stripe_account_id, plan")
    .eq("id", normalizedInput.business_id)
    .single();

  if (!business?.stripe_account_id) {
    throw new Error("Business has not connected Stripe account");
  }

  const effectivePlan = await resolveAccessPlanForBusiness({
    business: {
      id: business.id,
      owner_id: business.owner_id || null,
      plan: business.plan,
    },
  });

  if (!hasOperationalAccess(effectivePlan)) {
    throw new Error("Business is not enabled for checkout");
  }

  const paymentGate = getFeatureGate(effectivePlan, "stripe_payments");
  if (!paymentGate.allowed) {
    throw new Error(paymentGate.message || "Payments are locked on this business plan");
  }

  const usage = await loadBusinessUsageSnapshot(normalizedInput.business_id);
  const transactionLimit = getUsageLimitResult({
    plan: effectivePlan,
    limitKey: "max_transactions",
    current: Number(usage.max_transactions || 0),
    customMessage:
      "Trial businesses are limited to 10 bookings and orders total. Upgrade to Pro or Elite to continue taking transactions.",
  });

  if (!transactionLimit.allowed) {
    throw new Error(transactionLimit.message || "Transaction limit reached");
  }

  const feePercent = getPlatformFeePercent(effectivePlan);

  const applicationFee = Math.round(totalAmountCents * feePercent);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: normalizedInput.customer_email,
    payment_method_types: ["card"],
    line_items: resolvedServices.map((s) => ({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: Math.round((s.price || 0) * 100),
        product_data: {
          name: s.name,
          description: `${s.duration || 30} min`,
        },
      },
    })),
    success_url: `${baseUrl}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/booking-cancel`,
    payment_intent_data: {
      application_fee_amount: applicationFee,
      transfer_data: {
        destination: business.stripe_account_id,
      },
    },
    metadata: {
      kind: "booking",
      business_id: normalizedInput.business_id,
      customer_name: normalizedInput.customer_name,
      customer_email: normalizedInput.customer_email,
      phone: normalizedInput.phone,
      booking_time: bookingUtc,
      date: bookingDate,
      start_time: bookingStartTime,
      end_time: bookingEndTime,
      duration_minutes: String(totalDuration),
      service_ids: serviceIds.join(","),
      client_address: normalizedInput.client_address,
    },
  });

  await supabaseAdmin.from("bookings").insert({
    guest_name: normalizedInput.customer_name,
    guest_email: normalizedInput.customer_email,
    guest_phone: normalizedInput.phone,
    reminder_sent: false,
    customer_name: normalizedInput.customer_name,
    customer_email: normalizedInput.customer_email,
    phone: normalizedInput.phone,
    business_id: normalizedInput.business_id,
    date: bookingDate,
    start_time: bookingStartTime,
    end_time: bookingEndTime,
    booking_time: bookingUtc,
    duration_minutes: totalDuration,
    status: "pending",
    payment_status: "pending",
    stripe_session_id: session.id,
    client_address: normalizedInput.client_address,
    amount_total: totalAmountCents,
    total_amount: totalAmountCents,
    platform_fee: toBookingPlatformFeeValue(applicationFee),
    metadata: {
      service_ids: serviceIds,
      application_fee_cents: applicationFee,
    },
  });

  return {
    url: session.url,
    sessionId: session.id,
  };
}

export async function confirmBookingFromSessionId(sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (!session || session.mode !== "payment") {
    return { ok: false as const, reason: "Invalid session" };
  }

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .update({
      status: "confirmed",
      payment_status: "paid",
      stripe_session_id: session.id,
      payment_intent_id: session.payment_intent as string,
    })
    .eq("stripe_session_id", session.id)
    .select("id, phone")
    .maybeSingle();

  if (error) {
    return { ok: false as const, reason: error.message };
  }

  await sendBookingEmail({
    to: session.customer_email || "",
    subject: "Booking Confirmed",
    message: "Your booking is confirmed.",
  });

  if (data?.phone) {
    await sendBookingSMS({
      to: data.phone,
      message: "Booking confirmed!",
    });
  }

  return { ok: true as const, bookingId: data?.id };
}
