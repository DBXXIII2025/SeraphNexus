import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { errorResponse } from "@/lib/apiErrors";

type OrderItemInput = {
  id?: string;
  name?: string;
  title?: string;
  price?: number | string;
  unit_price?: number | string;
  amount?: number | string;
  quantity?: number | string;
  qty?: number | string;
};

type NormalizedOrderItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

type OrderPayload = {
  businessId?: string;
  customerName?: string;
  customerPhone?: string;
  fulfillmentType?: "pickup" | "delivery";
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
  notes?: string;
  items?: OrderItemInput[];
  orderItems?: OrderItemInput[];
  cart?: OrderItemInput[];
  totalCents?: number;
};

const isNonEmptyString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0;

function normalizeOrderItems(items: unknown): NormalizedOrderItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => {
    const rawItem = (item || {}) as OrderItemInput;
    return {
      id: String(rawItem.id ?? "").trim(),
      name: String(rawItem.name ?? rawItem.title ?? "").trim(),
      price: Number(rawItem.price ?? rawItem.unit_price ?? rawItem.amount ?? 0),
      quantity: Number(rawItem.quantity ?? rawItem.qty ?? 1),
    };
  });
}

export async function POST(req: Request) {
  let payload: OrderPayload;
  const isDev = process.env.NODE_ENV !== "production";

  try {
    payload = (await req.json()) as OrderPayload;
  } catch {
    return errorResponse({
      status: 400,
      error: "We couldn't read this order request.",
      code: "ORDER_CREATE_INVALID_JSON",
      step: "request.parse",
    });
  }

  if (!isNonEmptyString(payload.businessId)) {
    return errorResponse({
      status: 400,
      error: "Business is required to create an order.",
      code: "ORDER_CREATE_BUSINESS_REQUIRED",
      step: "request.validate",
    });
  }

  if (!isNonEmptyString(payload.customerName)) {
    return errorResponse({
      status: 400,
      error: "Customer name is required.",
      code: "ORDER_CREATE_NAME_REQUIRED",
      step: "request.validate",
    });
  }

  if (!isNonEmptyString(payload.customerPhone)) {
    return errorResponse({
      status: 400,
      error: "Customer phone is required.",
      code: "ORDER_CREATE_PHONE_REQUIRED",
      step: "request.validate",
    });
  }

  const rawOrderItems = payload.orderItems ?? payload.items ?? payload.cart ?? [];
  const normalizedOrderItems = normalizeOrderItems(rawOrderItems);

  if (normalizedOrderItems.length === 0) {
    return errorResponse({
      status: 400,
      error: "Add at least one item before creating an order.",
      code: "ORDER_CREATE_ITEMS_REQUIRED",
      step: "items.validate",
    });
  }

  const invalidItem = normalizedOrderItems.find(
    (item) =>
      !isNonEmptyString(item.id) ||
      !isNonEmptyString(item.name) ||
      !Number.isFinite(item.price) ||
      item.price <= 0 ||
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0
  );

  if (invalidItem) {
    return errorResponse({
      status: 400,
      error: "One or more order items are invalid.",
      code: "ORDER_CREATE_ITEMS_INVALID",
      step: "items.validate",
      extra: isDev
        ? {
            debug: {
              endpoint: "/api/orders/create",
              rawBody: payload,
              rawOrderItems,
              normalizedOrderItems,
            },
          }
        : undefined,
    });
  }

  if (payload.fulfillmentType === "delivery") {
    if (
      !isNonEmptyString(payload.address?.line1) ||
      !isNonEmptyString(payload.address?.city) ||
      !isNonEmptyString(payload.address?.state) ||
      !isNonEmptyString(payload.address?.postalCode)
    ) {
      return errorResponse({
        status: 400,
        error: "Delivery address is required for delivery orders.",
        code: "ORDER_CREATE_ADDRESS_REQUIRED",
        step: "address.validate",
      });
    }
  }

  if (
    payload.totalCents !== undefined &&
    (typeof payload.totalCents !== "number" || !Number.isFinite(payload.totalCents))
  ) {
    return errorResponse({
      status: 400,
      error: "Order total is invalid.",
      code: "ORDER_CREATE_TOTAL_INVALID",
      step: "amount.validate",
    });
  }

  return NextResponse.json({ success: true, orderId: randomUUID() });
}
