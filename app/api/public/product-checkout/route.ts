import { POST as createCheckoutPost } from "@/app/api/checkout/create/route";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { errorResponse, getErrorMessage, logRouteError } from "@/lib/apiErrors";
import { loadBusinessPreferences } from "@/lib/businessPreferences";

type ProductsTable = {
  select: (query: string) => {
    eq: (column: string, value: string) => {
      maybeSingle: () => Promise<{
        data: { id?: string | null; business_id?: string | null } | null;
        error: { message: string } | null;
      }>;
    };
  };
};

type ProductCheckoutPayload = {
  businessId?: string;
  product_id?: string;
  quantity?: number;
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
};

export async function POST(req: Request) {
  let step = "request.parse";

  try {
    const supabase = await createClient();
    const body = (await req.json()) as ProductCheckoutPayload;
    const productId = String(body.product_id || "").trim();

    if (!productId) {
      return errorResponse({
        status: 400,
        error: "Product is required to start checkout.",
        code: "PRODUCT_CHECKOUT_PRODUCT_REQUIRED",
        step: "request.validate",
      });
    }

    const productsTable = supabase.from("products") as unknown as ProductsTable;
    step = "product.read";
    const { data: product, error: productError } = await productsTable
      .select("id, business_id")
      .eq("id", productId)
      .maybeSingle();

    if (productError || !product?.id || !product.business_id) {
      if (productError) {
        logRouteError("public/product-checkout", {
          step,
          code: "PRODUCT_CHECKOUT_PRODUCT_READ_FAILED",
          message: productError.message,
          status: 500,
          error: productError,
          extra: { productId },
        });

        return errorResponse({
          status: 500,
          error: "We couldn't start checkout right now.",
          code: "PRODUCT_CHECKOUT_PRODUCT_READ_FAILED",
          step,
        });
      }

      return errorResponse({
        status: 404,
        error: "This product is unavailable.",
        code: "PRODUCT_CHECKOUT_PRODUCT_NOT_FOUND",
        step,
      });
    }

    const quantity =
      Number.isInteger(body.quantity) && Number(body.quantity) > 0
        ? Number(body.quantity)
        : 1;
    const businessId = String(body.businessId || product.business_id).trim();
    const preferences = await loadBusinessPreferences(createAdminClient(), businessId);
    const fulfillmentType =
      body.fulfillmentType ||
      (preferences.pickup_enabled ? "pickup" : preferences.delivery_enabled ? "delivery" : null);

    if (fulfillmentType !== "pickup" && fulfillmentType !== "delivery") {
      return errorResponse({
        status: 400,
        error: "Ordering is not available for this business right now.",
        code: "PRODUCT_CHECKOUT_FULFILLMENT_UNAVAILABLE",
        step: "fulfillment.validate",
      });
    }

    if (fulfillmentType === "pickup" && preferences.pickup_enabled === false) {
      return errorResponse({
        status: 400,
        error: "Pickup is not available for this business.",
        code: "PRODUCT_CHECKOUT_PICKUP_DISABLED",
        step: "fulfillment.validate",
      });
    }

    if (fulfillmentType === "delivery" && preferences.delivery_enabled === false) {
      return errorResponse({
        status: 400,
        error: "Delivery is not available for this business.",
        code: "PRODUCT_CHECKOUT_DELIVERY_DISABLED",
        step: "fulfillment.validate",
      });
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[public/product-checkout] forwarding to shared checkout route:", {
        businessId,
        productId,
        quantity,
        fulfillmentType,
      });
    }

    return createCheckoutPost(
      new Request(req.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intentType: "order",
          businessId,
          customer: {
            name: body.customerName,
            email: body.customerEmail,
            phone: body.customerPhone,
          },
          fulfillmentType,
          address: body.address,
          notes: body.notes,
          orderItems: [{ id: productId, quantity }],
        }),
      })
    );
  } catch (err: unknown) {
    logRouteError("public/product-checkout", {
      step,
      code: "PRODUCT_CHECKOUT_FAILED",
      message: getErrorMessage(err, "Failed to start product checkout"),
      status: 500,
      error: err,
    });

    return errorResponse({
      status: 500,
      error: "We couldn't start checkout right now.",
      code: "PRODUCT_CHECKOUT_FAILED",
      step,
    });
  }
}
