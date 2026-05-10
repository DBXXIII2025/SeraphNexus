import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { validateDiscountForCheckout } from "@/lib/discountCodes";

type CheckoutDiscountRequest = {
  business_id?: string;
  businessId?: string;
  type?: "service" | "rental" | "food" | "product";
  subtotal_cents?: number | string;
  subtotalCents?: number | string;
  code?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as CheckoutDiscountRequest;
  const businessId = String(body.business_id || body.businessId || "").trim();
  const code = String(body.code || "").trim();
  const type = body.type;
  const subtotalCents = Number(body.subtotal_cents ?? body.subtotalCents ?? 0);

  if (!businessId) {
    return NextResponse.json({ error: "Business is required." }, { status: 400 });
  }

  if (type !== "service" && type !== "rental" && type !== "food" && type !== "product") {
    return NextResponse.json({ error: "Checkout type is required." }, { status: 400 });
  }

  const result = await validateDiscountForCheckout({
    supabaseAdmin: createAdminClient(),
    businessId,
    code,
    checkoutType: type,
    subtotalCents,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        code: result.code,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    discount: result.discount,
  });
}
