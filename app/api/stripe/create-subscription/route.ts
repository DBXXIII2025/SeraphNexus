import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/appUrl";
import { requireEnv } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { isPlanTier, type PlanTier } from "@/lib/planConfig";

function getPriceIdForPlan(plan: PlanTier) {
  if (plan === "pro") {
    return (
      process.env.STRIPE_PRO_PRICE_ID ||
      process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ||
      process.env.STRIPE_GROWTH_PRICE_ID ||
      requireEnv("NEXT_PUBLIC_STRIPE_PRO_PRICE_ID")
    );
  }

  return (
    process.env.STRIPE_ELITE_PRICE_ID ||
    process.env.NEXT_PUBLIC_STRIPE_ELITE_PRICE_ID ||
    requireEnv("NEXT_PUBLIC_STRIPE_ELITE_PRICE_ID")
  );
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const body = await req.json();
    const requestedBusinessId =
      typeof body?.businessId === "string" ? body.businessId.trim() : "";
    const requestedPlan = body?.plan;

    if (!requestedBusinessId || !isPlanTier(requestedPlan) || requestedPlan === "free") {
      return NextResponse.json({ error: "Invalid upgrade request" }, { status: 400 });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("id, name, owner_id, stripe_customer_id")
      .eq("id", requestedBusinessId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    let customerId = business.stripe_customer_id as string | null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: business.name || undefined,
        metadata: {
          business_id: business.id,
        },
      });

      customerId = customer.id;

      await supabase
        .from("businesses")
        .update({ stripe_customer_id: customerId })
        .eq("id", business.id);
    }

    const priceId = body?.priceId || getPriceIdForPlan(requestedPlan);

    const appUrl = getAppUrl(req);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/admin/upgrade?billing=success`,
      cancel_url: `${appUrl}/admin/upgrade?billing=canceled`,
      metadata: {
        business_id: business.id,
        plan: requestedPlan,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to create subscription" },
      { status: 500 }
    );
  }
}
