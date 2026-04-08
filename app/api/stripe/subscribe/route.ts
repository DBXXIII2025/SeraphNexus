import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/appUrl";
import { getManagedPlanPricing, getStripePriceIdForManagedPlan } from "@/lib/platformBilling";
import { stripe } from "@/lib/stripe";
import { isPlanTier } from "@/lib/planConfig";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const body = await req.json().catch(() => ({}));
    const requestedPlan = isPlanTier(body?.plan) && body.plan !== "free"
      ? body.plan
      : "pro";

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requestedBusinessId =
      typeof body?.businessId === "string" ? body.businessId.trim() : "";

    let businessQuery = supabase
      .from("businesses")
      .select("id, name, owner_id, stripe_customer_id")
      .eq("owner_id", user.id);

    if (requestedBusinessId) {
      businessQuery = businessQuery.eq("id", requestedBusinessId);
    }

    const { data: business } = await businessQuery.maybeSingle();

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const pricing = await getManagedPlanPricing(requestedPlan);
    if (!pricing.active) {
      return NextResponse.json(
        {
          error: `${requestedPlan === "pro" ? "Pro" : "Elite"} billing is currently unavailable.`,
        },
        { status: 403 }
      );
    }

    let customerId = business.stripe_customer_id;

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

    const priceId = await getStripePriceIdForManagedPlan(requestedPlan);
    const appUrl = getAppUrl(req);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
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
        stripe_price_id: priceId,
      },
    });

    return NextResponse.json({
      url: session.url,
      plan: requestedPlan,
      amountCents: pricing.monthlyPriceCents,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to create subscription",
      },
      { status: 500 }
    );
  }
}
