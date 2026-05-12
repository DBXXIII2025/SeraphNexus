import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripeConnectAppUrl } from "@/lib/appUrl";
import { resolveAccessPlanForBusiness } from "@/lib/accessGrants";
import { getFeatureGate } from "@/lib/planEnforcement";
import { loadMissingLegalDocumentKeysSafe } from "@/lib/legalAcceptance";
import { ensureBusinessStripeExpressAccount } from "@/lib/stripeConnect";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

type ManagePayload = {
  businessId?: string;
};

type BusinessRow = {
  id: string;
  name: string | null;
  owner_id: string;
  slug?: string | null;
  description?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  stripe_account_id: string | null;
  plan?: string | null;
  business_type?: string | null;
};

function getValidatedBaseUrl(req: Request) {
  const appUrl = getStripeConnectAppUrl(req);
  return new URL(appUrl).origin;
}

function buildLegalAcceptanceUrl(baseUrl: string, businessId: string) {
  const url = new URL("/legal/acceptance", baseUrl);
  url.searchParams.set("businessId", businessId);
  url.searchParams.set("next", `/admin/settings?businessId=${businessId}&setup=stripe`);
  return url.toString();
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
      .select(
        "id, name, owner_id, slug, description, email, phone, website, stripe_account_id, plan, business_type"
      )
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
        { error: paymentGate.message || "Stripe payments require Starter Access or higher." },
        { status: 403 }
      );
    }

    const baseUrl = getValidatedBaseUrl(req);
    const legalState = await loadMissingLegalDocumentKeysSafe({
      supabase: supabase as never,
      userId: user.id,
      businessId: ownedBusiness.id,
      businessType: ownedBusiness.business_type || null,
    });

    if (!legalState.unavailable && legalState.missingDocumentKeys.length > 0) {
      return NextResponse.json(
        {
          error: "Accept the required payment-processing disclosures before managing Stripe.",
          redirectTo: buildLegalAcceptanceUrl(baseUrl, ownedBusiness.id),
        },
        { status: 403 }
      );
    }

    const refreshUrl = new URL("/admin/settings", baseUrl);
    refreshUrl.searchParams.set("businessId", ownedBusiness.id);
    refreshUrl.searchParams.set("setup", "stripe");
    refreshUrl.searchParams.set("stripe", "refresh");

    const returnUrl = new URL("/api/stripe/return", baseUrl);
    returnUrl.searchParams.set("businessId", ownedBusiness.id);

    const stripeAccountId = await ensureBusinessStripeExpressAccount({
      supabase,
      business: ownedBusiness,
      ownerUserId: user.id,
      ownerEmail: user.email || null,
      baseUrl,
    });

    const account = await stripe.accounts.retrieve(stripeAccountId);
    if (!("deleted" in account) && account.type === "express" && account.details_submitted) {
      console.info("[stripe/manage] computed dashboard redirect URL", {
        businessId: ownedBusiness.id,
        refreshUrl: refreshUrl.toString(),
      });

      const loginLink = await stripe.accounts.createLoginLink(stripeAccountId);

      return NextResponse.json({ url: loginLink.url });
    }

    console.info("[stripe/manage] computed onboarding redirect URLs", {
      businessId: ownedBusiness.id,
      refreshUrl: refreshUrl.toString(),
      returnUrl: returnUrl.toString(),
    });

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
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
