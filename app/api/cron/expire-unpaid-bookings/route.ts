import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { confirmBookingFromSessionId } from "@/lib/stripeBooking";
import { buildCancelledStatusUpdate } from "@/lib/transactionVisibility";

const supabase = createAdminClient();

const DEFAULT_TTL_MINUTES = 30;

function isMissingColumnError(message?: string | null) {
  const text = (message || "").toLowerCase();
  return text.includes("could not find the") && text.includes("column");
}

function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const headerSecret = req.headers.get("x-cron-secret");
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  return headerSecret === secret || bearer === secret;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ttlMinutes = Number(
    process.env.PENDING_BOOKING_TTL_MINUTES || DEFAULT_TTL_MINUTES
  );
  const ttlSeconds = Math.max(1, ttlMinutes) * 60;
  const nowSeconds = Math.floor(Date.now() / 1000);

  const { data: bookingsWithPaymentStatus, error: bookingQueryError } =
    await supabase
      .from("bookings")
      .select("id, stripe_session_id, status, payment_status")
      .eq("status", "pending")
      .eq("payment_status", "pending")
      .not("stripe_session_id", "is", null)
      .limit(200);

  if (bookingQueryError && !isMissingColumnError(bookingQueryError.message)) {
    return NextResponse.json({ error: bookingQueryError.message }, { status: 500 });
  }

  let bookings = bookingsWithPaymentStatus;

  if (bookingQueryError && isMissingColumnError(bookingQueryError.message)) {
    const { data: fallbackBookings, error: fallbackError } = await supabase
      .from("bookings")
      .select("id, stripe_session_id, status")
      .eq("status", "pending")
      .not("stripe_session_id", "is", null)
      .limit(200);

    if (fallbackError) {
      return NextResponse.json({ error: fallbackError.message }, { status: 500 });
    }

    bookings = fallbackBookings;
  }

  let confirmed = 0;
  let cancelled = 0;
  let expired = 0;
  let skipped = 0;

  for (const booking of bookings ?? []) {
    const sessionId = booking.stripe_session_id as string | null;
    if (!sessionId) {
      skipped += 1;
      continue;
    }

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      const paid = session.payment_status === "paid" || session.status === "complete";

      if (paid) {
        const result = await confirmBookingFromSessionId(sessionId);
        if (result.ok) {
          confirmed += 1;
        } else {
          skipped += 1;
        }
        continue;
      }

      const ageSeconds = nowSeconds - session.created;
      const stale = ageSeconds >= ttlSeconds;
      if (!stale) {
        skipped += 1;
        continue;
      }

      if (session.status === "open") {
        await stripe.checkout.sessions.expire(sessionId);
        expired += 1;
      }

      const { error: cancelError } = await supabase
        .from("bookings")
        .update(buildCancelledStatusUpdate("system", "cancelled"))
        .eq("id", booking.id);

      if (cancelError) {
        skipped += 1;
        continue;
      }

      cancelled += 1;
    } catch {
      skipped += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    ttl_minutes: ttlMinutes,
    checked: bookings?.length ?? 0,
    confirmed,
    expired,
    cancelled,
    skipped,
  });
}
