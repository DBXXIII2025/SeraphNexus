import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { sendBookingEmail, sendBookingSMS } from "@/lib/notify";
import { errorResponse, getErrorMessage, logRouteError } from "@/lib/apiErrors";

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

export async function POST(req: Request) {
  let step = "request.validate";

  try {
    const supabase = await createClient();
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

    const { data: booking } = await bookingsTable
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!booking) {
      return errorResponse({
        status: 404,
        error: "This booking could not be found.",
        code: "BOOKING_REFUND_NOT_FOUND",
        step: "booking.read",
      });
    }

    const { data: business } = await businessesTable
      .select("id")
      .eq("id", booking.business_id)
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

    if (booking.payment_status === "refunded") {
      return errorResponse({
        status: 409,
        error: "This booking has already been refunded.",
        code: "BOOKING_ALREADY_REFUNDED",
        step: "refund.validate",
      });
    }

    let paymentIntentId = booking.payment_intent_id;

    if (!paymentIntentId && booking.stripe_session_id) {
      step = "stripe.session.lookup";
      const session = await stripe.checkout.sessions.retrieve(
        booking.stripe_session_id
      );

      paymentIntentId = session.payment_intent as string;

      await bookingsTable
        .update({ payment_intent_id: paymentIntentId })
        .eq("id", booking.id);
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
    await bookingsTable
      .update({
        status: "cancelled",
        payment_status: "refunded",
      })
      .eq("id", booking.id)
      .eq("business_id", business.id);

    await sendBookingEmail({
      to: booking.customer_email,
      subject: "Your booking was refunded",
      message: "Your booking has been cancelled and refunded.",
    });

    if (booking.phone) {
      await sendBookingSMS({
        to: booking.phone,
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
