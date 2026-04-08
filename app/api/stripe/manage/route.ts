import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/appUrl";
import { resolveAccessPlanForBusiness } from "@/lib/accessGrants";
import { getFeatureGate } from "@/lib/planEnforcement";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

type ManagePayload = {
  businessId?: string;
};

type BusinessRow = {
  id: string;
  name: string | null;
  owner_id: string;
  stripe_account_id: string | null;
  plan?: string | null;
};

function getValidatedBaseUrl(req: Request) {
  const appUrl = getAppUrl(req);
  return new URL(appUrl).origin;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as ManagePayload | null;
    const businessId = body?.businessId?.trim();

    if (!businessId) {
      return NextResponse.json({ error: "Missing businessId" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, name, owner_id, stripe_account_id, plan")
      .eq("id", businessId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (businessError) {
      return NextResponse.json({ error: businessError.message }, { status: 500 });
    }

    const ownedBusiness = business as BusinessRow | null;

    if (!ownedBusiness?.id) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const effectivePlan = await resolveAccessPlanForBusiness({
      business: {
        id: ownedBusiness.id,
        owner_id: ownedBusiness.owner_id,
        plan: ownedBusiness.plan || null,
      },
      userId: user.id,
      email: user.email || null,
    });

    const paymentGate = getFeatureGate(effectivePlan, "stripe_payments");
    if (!paymentGate.allowed) {
      return NextResponse.json(
        { error: paymentGate.message || "Stripe payments require a Pro or Elite plan." },
        { status: 403 }
      );
    }

    if (!ownedBusiness.stripe_account_id) {
      return NextResponse.json(
        { error: "Connect Stripe before opening Stripe account management." },
        { status: 400 }
      );
    }

    const baseUrl = getValidatedBaseUrl(req);
    const refreshUrl = new URL("/admin/settings", baseUrl);
    refreshUrl.searchParams.set("businessId", ownedBusiness.id);
    refreshUrl.searchParams.set("setup", "stripe");
    refreshUrl.searchParams.set("stripe", "refresh");

    const returnUrl = new URL("/api/stripe/return", baseUrl);
    returnUrl.searchParams.set("businessId", ownedBusiness.id);

    const account = await stripe.accounts.retrieve(ownedBusiness.stripe_account_id);
    if (!("deleted" in account) && account.type === "express" && account.details_submitted) {
      const loginLink = await stripe.accounts.createLoginLink(ownedBusiness.stripe_account_id, {
        redirect_url: refreshUrl.toString(),
      });

      return NextResponse.json({ url: loginLink.url });
    }

    const accountLink = await stripe.accountLinks.create({
      account: ownedBusiness.stripe_account_id,
      refresh_url: refreshUrl.toString(),
      return_url: returnUrl.toString(),
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error: unknown) {
    console.error("[stripe/manage] failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to open Stripe account management",
      },
      { status: 500 }
    );
  }
}
