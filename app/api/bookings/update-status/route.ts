import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { buildCancelledStatusUpdate } from "@/lib/transactionVisibility";
import { updateCheckoutIntentSafely } from "@/lib/checkoutIntents";

const ALLOWED_STATUSES = new Set(["confirmed", "cancelled"]);

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();
    const formData = await req.formData();

    const id = String(formData.get("id") || "");
    const status = String(formData.get("status") || "");

    if (!id || !ALLOWED_STATUSES.has(status)) {
      return NextResponse.redirect(new URL("/admin/bookings", req.url));
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const bookingsTable = supabase.from("bookings") as any;
    const businessesTable = supabase.from("businesses") as any;

    const { data: booking } = await bookingsTable
      .select("id, business_id, status, payment_status, stripe_session_id, metadata")
      .eq("id", id)
      .maybeSingle();

    if (!booking?.business_id) {
      return NextResponse.redirect(new URL("/admin/bookings", req.url));
    }

    const { data: business } = await businessesTable
      .select("id")
      .eq("id", booking.business_id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!business) {
      return NextResponse.redirect(new URL("/admin/bookings", req.url));
    }

    const nextPaymentStatus =
      booking.payment_status === "refunded"
        ? "refunded"
        : booking.payment_status === "paid"
          ? "paid"
          : booking.payment_status || "pending";

    const payload =
      status === "cancelled"
        ? buildCancelledStatusUpdate("owner", "cancelled", {
            payment_status: nextPaymentStatus,
          })
        : {
            status,
            payment_status: nextPaymentStatus,
          };

    if (process.env.NODE_ENV !== "production") {
      console.log("[bookings/update-status]", {
        bookingId: id,
        businessId: business.id,
        previousStatus: booking.status || null,
        previousPaymentStatus: booking.payment_status || null,
        nextStatus: status,
      });
    }

    await bookingsTable.update(payload).eq("id", id).eq("business_id", business.id);

    const metadata = booking?.metadata && typeof booking.metadata === "object" ? booking.metadata : {};
    const checkoutIntentId = asString((metadata as Record<string, unknown>).checkout_intent_id);

    if (checkoutIntentId) {
      const nextIntentStatus =
        status === "confirmed" && nextPaymentStatus === "paid"
          ? "paid"
          : status === "cancelled" && nextPaymentStatus === "refunded"
            ? "refunded"
            : status;

      await updateCheckoutIntentSafely({
        supabaseAdmin,
        intentId: checkoutIntentId,
        payload: {
          status: nextIntentStatus,
          booking_id: id,
          stripe_checkout_session_id: booking.stripe_session_id || null,
          metadata: {
            ...(metadata as Record<string, unknown>),
            booking_id: id,
          },
        },
        context: {
          source: "admin-bookings-update-status",
          bookingId: id,
          businessId: business.id,
          status,
        },
      });
    }

    return NextResponse.redirect(new URL("/admin/bookings", req.url));
  } catch {
    return NextResponse.redirect(new URL("/admin/bookings?error=status", req.url));
  }
}
