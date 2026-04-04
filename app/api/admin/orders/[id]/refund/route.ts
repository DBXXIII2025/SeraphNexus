import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { errorResponse, getErrorMessage, logRouteError } from "@/lib/apiErrors";
import { buildCancelledStatusUpdate } from "@/lib/transactionVisibility";

type OrdersTable = {
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

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let step = "request.validate";

  try {
    const { id } = await params;
    const supabase = await createClient();

    if (!id) {
      return NextResponse.redirect(new URL("/admin/orders", req.url));
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const ordersTable = supabase.from("orders") as unknown as OrdersTable;
    const businessesTable = supabase.from("businesses") as unknown as BusinessesTable;

    const { data: order } = await ordersTable
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!order?.business_id) {
      return NextResponse.redirect(new URL("/admin/orders", req.url));
    }

    const { data: business } = await businessesTable
      .select("id")
      .eq("id", order.business_id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!business) {
      return errorResponse({
        status: 403,
        error: "You do not have access to refund this order.",
        code: "ADMIN_ORDER_REFUND_FORBIDDEN",
        step: "auth.business_scope",
      });
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[admin/orders/refund] start:", {
        orderId: id,
        businessId: business.id,
      });
    }

    if (order.payment_status === "refunded") {
      return errorResponse({
        status: 409,
        error: "This order has already been refunded.",
        code: "ADMIN_ORDER_ALREADY_REFUNDED",
        step: "refund.validate",
      });
    }

    let paymentIntentId = order.payment_intent_id as string | null;

    if (!paymentIntentId && order.stripe_session_id) {
      step = "stripe.session.lookup";
      const session = await stripe.checkout.sessions.retrieve(
        String(order.stripe_session_id)
      );
      paymentIntentId = session.payment_intent as string | null;

      if (paymentIntentId) {
        await ordersTable
          .update({ payment_intent_id: paymentIntentId })
          .eq("id", order.id)
          .eq("business_id", business.id);
      }
    }

    if (!paymentIntentId) {
      return errorResponse({
        status: 400,
        error: "This order is missing a refundable payment reference.",
        code: "ADMIN_ORDER_PAYMENT_INTENT_MISSING",
        step: "refund.validate",
      });
    }

    step = "stripe.refund.create";
    await stripe.refunds.create({
      payment_intent: paymentIntentId,
    });

    step = "order.update";
    await ordersTable
      .update(buildCancelledStatusUpdate("owner", "canceled", { payment_status: "refunded" }))
      .eq("id", order.id)
      .eq("business_id", business.id);

    if (process.env.NODE_ENV !== "production") {
      console.log("[admin/orders/refund] success:", {
        orderId: id,
        businessId: business.id,
      });
    }

    return NextResponse.redirect(new URL("/admin/orders", req.url));
  } catch (err: unknown) {
    logRouteError("admin/orders/refund", {
      step,
      code: "ADMIN_ORDER_REFUND_FAILED",
      message: getErrorMessage(err, "Refund failed"),
      status: 500,
      error: err,
    });

    return errorResponse({
      status: 500,
      error: "We couldn't refund this order right now.",
      code: "ADMIN_ORDER_REFUND_FAILED",
      step,
    });
  }
}
