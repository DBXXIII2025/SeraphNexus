import { NextResponse } from "next/server";
import {
  ReconciliationError,
  finalizeCheckoutSession,
} from "@/lib/checkoutFinalization";
import { errorResponse, getErrorMessage, logRouteError } from "@/lib/apiErrors";
import { createAdminClient } from "@/lib/supabase/server";
import {
  asArray,
  asNumber,
  asRecord,
  asString,
  formatAddress,
  formatCurrency,
  titleCaseStatus,
  type TransactionConfirmationPayload,
} from "@/lib/transactionConfirmation";
import { applyVisibleFilter } from "@/lib/transactionVisibility";

const supabaseAdmin = createAdminClient();

type OrderRowLike = Record<string, unknown>;
type OrderItemRowLike = {
  name?: unknown;
  quantity?: unknown;
};

function normalizeItems(value: unknown) {
  return asArray(value)
    .map((item) => {
      const record = asRecord(item);
      const name = asString(record.name) || asString(record.title) || "Item";
      const quantity = Math.max(1, asNumber(record.quantity ?? record.qty ?? 1));
      return {
        name,
        quantity,
      };
    })
    .filter((item) => Boolean(item.name));
}

function buildFinalizingConfirmation({
  sessionId,
  orderRef,
}: {
  sessionId: string;
  orderRef?: string | null;
}): TransactionConfirmationPayload {
  return {
    state: "finalizing",
    transactionType: "food_order",
    headline: "Finalizing your order",
    message:
      "Your payment was received and we are completing the order confirmation now.",
    nextStep:
      "Keep this page open while we finish the confirmation. If it does not update shortly, use the reference below when contacting support.",
    reference: orderRef || sessionId,
    paymentSummary: "Payment received",
    businessName: null,
    businessSlug: null,
    businessType: null,
    sections: [],
  };
}

function buildNeedsAttentionConfirmation({
  sessionId,
  orderRef,
}: {
  sessionId: string;
  orderRef?: string | null;
}): TransactionConfirmationPayload {
  return {
    state: "needs_attention",
    transactionType: "food_order",
    headline: "Order needs review",
    message:
      "We received your payment, but the order confirmation still needs manual review.",
    nextStep:
      "Please contact support or the business with your reference so the team can finish the order confirmation quickly.",
    reference: orderRef || sessionId,
    paymentSummary: "Payment received",
    businessName: null,
    businessSlug: null,
    businessType: null,
    sections: [],
  };
}

export async function GET(req: Request) {
  const isDev = process.env.NODE_ENV !== "production";
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");
  const orderRef = searchParams.get("order_ref");

  if (!sessionId) {
    return errorResponse({
      status: 400,
      error: "A checkout session reference is required to load this confirmation.",
      code: "ORDER_STATUS_SESSION_REQUIRED",
      step: "request.validate",
    });
  }

  try {
    const result = await finalizeCheckoutSession({
      sessionId,
      orderRef,
      source: "order-status",
    });

    const { data: checkoutIntent } = await supabaseAdmin
      .from("checkout_intents")
      .select("id, business_id, address_json, order_items, metadata, meta_json, amount_total")
      .eq("stripe_checkout_session_id", sessionId)
      .maybeSingle();

    const intentMetadata = asRecord(
      checkoutIntent?.metadata ?? checkoutIntent?.meta_json
    );
    const resolvedOrderId = result.orderId || orderRef || null;
    const ordersTable = supabaseAdmin.from("orders") as unknown as {
      select: (query: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{ data: OrderRowLike | null }>;
        };
      };
    };
    const { data: order } = result.orderId
      ? await applyVisibleFilter(
          ordersTable.select("*").eq("id", result.orderId)
        ).maybeSingle()
      : await applyVisibleFilter(
          ordersTable
            .select("*")
            .eq("stripe_session_id", sessionId)
        ).maybeSingle();

    let orderItems: Array<{ name: string; quantity: number }> = [];
    if (result.orderId) {
      try {
        const orderItemsTable = supabaseAdmin.from("order_items") as unknown as {
          select: (query: string) => {
            eq: (column: string, value: string) => Promise<{
              data: OrderItemRowLike[] | null;
            }>;
          };
        };
        const { data: rows } = await orderItemsTable
          .select("name, quantity")
          .eq("order_id", result.orderId);
        orderItems = (rows || []).map((item) => ({
          name: String(item.name || "Item"),
          quantity: Math.max(1, Number(item.quantity || 1)),
        }));
      } catch {
        orderItems = [];
      }
    }

    if (orderItems.length === 0) {
      orderItems = normalizeItems(
        checkoutIntent?.order_items ?? intentMetadata.order_items
      );
    }

    const businessId =
      asString(order?.business_id) ||
      asString(checkoutIntent?.business_id) ||
      asString(intentMetadata.business_id);
    const { data: business } = businessId
      ? await supabaseAdmin
          .from("businesses")
          .select("id, name, slug, business_type")
          .eq("id", businessId)
          .maybeSingle()
      : { data: null };

    const businessType = business?.business_type || null;
    const isStoreOrder =
      businessType === "store" ||
      businessType === "product" ||
      businessType === "creator";
    const transactionType = isStoreOrder ? "store_order" : "food_order";
    const paymentStatus =
      titleCaseStatus(asString(order?.payment_status)) ||
      titleCaseStatus(result.paymentStatus) ||
      "Paid";
    const totalPaid =
      formatCurrency(asNumber(order?.total_amount || 0)) ||
      formatCurrency(asNumber(checkoutIntent?.amount_total) / 100) ||
      null;
    const fulfillmentType =
      asString(order?.fulfillment_type) ||
      asString(intentMetadata.fulfillment_type) ||
      "pickup";
    const address =
      formatAddress(checkoutIntent?.address_json) ||
      formatAddress(intentMetadata.address);
    const itemSummary =
      orderItems.length > 0
        ? orderItems.map((item) => `${item.name} x${item.quantity}`).join(", ")
        : "Items confirmed";
    const confirmation: TransactionConfirmationPayload =
      result.paid && resolvedOrderId
        ? {
            state: "confirmed",
            transactionType,
            headline: "Order confirmed",
            message: isStoreOrder
              ? "Your order is confirmed and the business can now prepare fulfillment."
              : "Your order is confirmed and has been sent to the business.",
            nextStep: isStoreOrder
              ? fulfillmentType === "delivery"
                ? "The business can now prepare shipment or delivery using the address you provided."
                : "The business can now prepare your order for pickup."
              : fulfillmentType === "delivery"
                ? "The business can now prepare your order for delivery."
                : "Prepare for pickup once the business marks your order ready.",
            reference: resolvedOrderId,
            paymentSummary: paymentStatus,
            businessName: business?.name || null,
            businessSlug: business?.slug || null,
            businessType,
            sections: [
              {
                title: isStoreOrder ? "Order" : "Items",
                items: [
                  { label: "Summary", value: itemSummary },
                  ...(orderItems.length > 0
                    ? orderItems.map((item, index) => ({
                        label: `Item ${index + 1}`,
                        value: `${item.name} x${item.quantity}`,
                      }))
                    : []),
                ],
              },
              {
                title: "Fulfillment",
                items: [
                  {
                    label: "Method",
                    value:
                      fulfillmentType === "delivery"
                        ? isStoreOrder
                          ? "Shipping / delivery"
                          : "Delivery"
                        : "Pickup",
                  },
                  ...(fulfillmentType === "delivery" && address
                    ? [
                        {
                          label: isStoreOrder ? "Shipping address" : "Delivery address",
                          value: address,
                        },
                      ]
                    : []),
                ],
              },
              {
                title: "Payment",
                items: [
                  ...(totalPaid ? [{ label: "Total paid", value: totalPaid }] : []),
                  { label: "Payment status", value: paymentStatus },
                ],
              },
            ].filter((section) => section.items.length > 0),
          }
        : {
            ...buildFinalizingConfirmation({ sessionId, orderRef }),
            transactionType,
            businessName: business?.name || null,
            businessSlug: business?.slug || null,
            businessType,
          };

    return NextResponse.json({
      paid: result.paid,
      status: result.status,
      orderRef: resolvedOrderId || result.checkoutIntentId || orderRef || null,
      orderStatus: result.orderStatus,
      paymentStatus: result.paymentStatus,
      confirmation,
    });
  } catch (err: unknown) {
    if (err instanceof ReconciliationError) {
      logRouteError("public/order-status", {
        step: err.step,
        code: err.code || "ORDER_STATUS_RECONCILIATION_FAILED",
        message: err.message,
        status: 200,
        error: err,
        extra: {
          sessionId,
          orderRef: orderRef || null,
        },
      });

      return NextResponse.json(
        {
          ok: false,
          error: "We couldn't confirm this order yet.",
          code: err.code || "ORDER_STATUS_RECONCILIATION_FAILED",
          step: err.step,
          paid: false,
          status: "error",
          orderRef: orderRef || sessionId,
          orderStatus: null,
          paymentStatus: null,
          confirmation: buildNeedsAttentionConfirmation({ sessionId, orderRef }),
          debug: isDev
            ? {
                step: err.step,
                message: err.message,
                code: err.code ?? null,
                details: err.details ?? null,
                hint: err.hint ?? null,
              }
            : undefined,
        },
        { status: 200 }
      );
    }

    logRouteError("public/order-status", {
      step: "status.load",
      code: "ORDER_STATUS_LOOKUP_FAILED",
      message: getErrorMessage(err, "Order status lookup failed"),
      status: 200,
      error: err,
      extra: {
        sessionId,
        orderRef: orderRef || null,
      },
    });

    return NextResponse.json(
      {
        ok: false,
        error: "We couldn't confirm this order yet.",
        code: "ORDER_STATUS_LOOKUP_FAILED",
        step: "status.load",
        paid: false,
        status: "error",
        orderRef: orderRef || sessionId,
        orderStatus: null,
        paymentStatus: null,
        confirmation: buildNeedsAttentionConfirmation({ sessionId, orderRef }),
        debug:
          isDev && err instanceof Error
            ? { message: err.message }
            : isDev
              ? { message: "Failed to lookup order status" }
              : undefined,
      },
      { status: 200 }
    );
  }
}
