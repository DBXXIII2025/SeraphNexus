import { POST as createCheckoutPost } from "@/app/api/checkout/create/route";

type LegacyOrderCheckoutPayload = {
  businessId?: string;
  customerName?: string;
  customerEmail?: string;
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
  items?: unknown[];
  orderItems?: unknown[];
  cart?: unknown[];
};

export async function POST(req: Request) {
  const body = (await req.json()) as LegacyOrderCheckoutPayload;
  const forwardedBody = {
    intentType: "order",
    businessId: body.businessId,
    customer: {
      name: body.customerName,
      email: body.customerEmail,
      phone: body.customerPhone,
    },
    fulfillmentType: body.fulfillmentType,
    address: body.address,
    notes: body.notes,
    items: body.orderItems ?? body.items ?? body.cart ?? [],
  };

  if (process.env.NODE_ENV !== "production") {
    console.log("[public/order-checkout] forwarding to shared checkout route:", {
      businessId: body.businessId || null,
      itemCount: Array.isArray(forwardedBody.items) ? forwardedBody.items.length : 0,
      fulfillmentType: body.fulfillmentType || null,
    });
  }

  return createCheckoutPost(
    new Request(req.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(forwardedBody),
    })
  );
}
