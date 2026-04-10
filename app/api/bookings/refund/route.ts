import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { sendBookingEmail, sendBookingSMS } from "@/lib/notify";
import { errorResponse, getErrorMessage, logRouteError } from "@/lib/apiErrors";
import { updateCheckoutIntentSafely } from "@/lib/checkoutIntents";

type BookingsTable = {
  select: (query: string) => {
    eq: (column: string, value: string) => {
      maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
    };
  };
  update: (payload: Record<string, unknown>) => {
    eq: (column: string, value: string) => {
      eq: (column2: string, value2: string) => Promise<{ error?: { message: string } | null }>;
    };
  };
};

type BusinessesTable = {
  select: (query: string) => {
    eq: (column: string, value: string) => {
      eq: (column2: string, value2: string) => {
        maybeSingle: () => Promise<{ data: { id?: string | null } | null }>;
      };
    };
  };
};

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function POST(req: Request) {
  let step = "request.validate";

  try {
    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();
    const formData = await req.formData();
    const id = String(formData.get("id") || "");

    if (!id) {
      return errorResponse({
        status: 400,
        error: "Booking ID is required to process a refund.",
        code: "BOOKING_REFUND_ID_REQUIRED",
        step,
      });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const bookingsTable = supabase.from("bookings") as unknown as BookingsTable;
    const businessesTable = supabase.from("businesses") as unknown as BusinessesTable;

    const { data: bookingRow } = await bookingsTable
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!bookingRow) {
      return errorResponse({
        status: 404,
        error: "This booking could not be found.",
        code: "BOOKING_REFUND_NOT_FOUND",
        step: "booking.read",
      });
    }

    const booking = bookingRow as Record<string, unknown>;
    const bookingId = asString(booking.id);
    const bookingBusinessId = asString(booking.business_id);
    const bookingStatus = asString(booking.status);
    const bookingPaymentStatus = asString(booking.payment_status);
    const bookingSessionId = asString(booking.stripe_session_id);
    const bookingCustomerEmail =
      asString(booking.customer_email) || asString(booking.guest_email);
    const bookingPhone = asString(booking.phone) || asString(booking.guest_phone);

    if (!bookingId || !bookingBusinessId) {
      return errorResponse({
        status: 400,
        error: "This booking is missing required identifiers.",
        code: "BOOKING_REFUND_INVALID_RECORD",
        step: "booking.read",
      });
    }

    const { data: business } = await businessesTable
      .select("id")
      .eq("id", bookingBusinessId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!business) {
      return errorResponse({
        status: 403,
        error: "You do not have access to refund this booking.",
        code: "BOOKING_REFUND_FORBIDDEN",
        step: "auth.business_scope",
      });
    }

    if (bookingPaymentStatus === "refunded") {
      return errorResponse({
        status: 409,
        error: "This booking has already been refunded.",
        code: "BOOKING_ALREADY_REFUNDED",
        step: "refund.validate",
      });
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[bookings/refund] start:", {
        bookingId,
        businessId: business.id,
        previousStatus: bookingStatus,
        previousPaymentStatus: bookingPaymentStatus,
      });
    }

    let paymentIntentId = asString(booking.payment_intent_id);

    if (!paymentIntentId && bookingSessionId) {
      step = "stripe.session.lookup";
      const session = await stripe.checkout.sessions.retrieve(bookingSessionId);

      paymentIntentId = session.payment_intent as string;

      await bookingsTable
        .update({ payment_intent_id: paymentIntentId })
        .eq("id", bookingId);
    }

    if (!paymentIntentId) {
      return errorResponse({
        status: 400,
        error: "This booking is missing a refundable payment reference.",
        code: "BOOKING_PAYMENT_INTENT_MISSING",
        step: "refund.validate",
      });
    }

    step = "stripe.refund.create";
    await stripe.refunds.create({
      payment_intent: paymentIntentId,
    });

    step = "booking.update";
    const refundedPayload = {
      status: "cancelled",
      payment_status: "refunded",
    };

    await bookingsTable
      .update(refundedPayload)
      .eq("id", bookingId)
      .eq("business_id", bookingBusinessId);

    const metadata = asRecord(booking.metadata);
    const checkoutIntentId =
      typeof metadata.checkout_intent_id === "string" && metadata.checkout_intent_id.trim()
        ? metadata.checkout_intent_id.trim()
        : null;

    if (checkoutIntentId) {
      await updateCheckoutIntentSafely({
        supabaseAdmin,
        intentId: checkoutIntentId,
        payload: {
          status: "refunded",
          booking_id: bookingId,
          stripe_payment_intent_id: paymentIntentId,
          stripe_checkout_session_id: bookingSessionId,
          metadata: {
            ...metadata,
            booking_id: bookingId,
            refund_status: "refunded",
          },
        },
        context: {
          source: "admin-bookings-refund",
          bookingId,
          businessId: bookingBusinessId,
        },
      });
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[bookings/refund] success:", {
        bookingId,
        businessId: business.id,
        paymentIntentId,
      });
    }

    if (bookingCustomerEmail) {
      await sendBookingEmail({
        to: bookingCustomerEmail,
        subject: "Your booking was refunded",
        message: "Your booking has been cancelled and refunded.",
      });
    }

    if (bookingPhone) {
      await sendBookingSMS({
        to: bookingPhone,
        message: "Your booking has been refunded.",
      });
    }

    return NextResponse.redirect(new URL("/admin/bookings", req.url));
  } catch (err: unknown) {
    logRouteError("bookings/refund", {
      step,
      code: "BOOKING_REFUND_FAILED",
      message: getErrorMessage(err, "Refund failed"),
      status: 500,
      error: err,
    });

    return errorResponse({
      status: 500,
      error: "We couldn't refund this booking right now.",
      code: "BOOKING_REFUND_FAILED",
      step,
    });
  }
}
