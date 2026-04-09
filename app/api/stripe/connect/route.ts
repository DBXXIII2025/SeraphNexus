import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripeConnectAppUrl } from "@/lib/appUrl";
import { resolveAccessPlanForBusiness } from "@/lib/accessGrants";
import { getFeatureGate } from "@/lib/planEnforcement";
import { ensureBusinessStripeExpressAccount } from "@/lib/stripeConnect";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

type ConnectPayload = {
  businessId?: string;
};

type BusinessRow = {
  id: string;
  name: string | null;
  owner_id: string;
  stripe_account_id: string | null;
  plan?: string | null;
  email?: string | null;
};

type StripeLikeError = Error & {
  type?: string;
  code?: string;
  statusCode?: number;
  raw?: {
    message?: string;
  } | unknown;
};

function validateStripeSecretKey() {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is missing");
  }

  if (key.includes("...")) {
    throw new Error(
      "STRIPE_SECRET_KEY contains placeholder text. Replace it with your full real Stripe secret key."
    );
  }

  if (!key.startsWith("sk_test_") && !key.startsWith("sk_live_")) {
    throw new Error(
      "STRIPE_SECRET_KEY must start with sk_test_ or sk_live_."
    );
  }

  return key;
}

function getValidatedBaseUrl(req: Request) {
  const appUrl = getStripeConnectAppUrl(req);
  const parsed = new URL(appUrl);
  return parsed.origin;
}

export async function POST(req: Request) {
  const isDev = process.env.NODE_ENV !== "production";

  try {
    const body = (await req.json().catch(() => null)) as ConnectPayload | null;
    const businessId = body?.businessId?.trim();

    if (!businessId) {
      return NextResponse.json(
        { error: "Missing businessId" },
        { status: 400 }
      );
    }

    validateStripeSecretKey();

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
      .select("*")
      .eq("id", businessId)
      .maybeSingle();

    if (businessError) {
      return NextResponse.json(
        { error: businessError.message },
        { status: 500 }
      );
    }

    const ownedBusiness = business as BusinessRow | null;

    if (!ownedBusiness) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    if (ownedBusiness.owner_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    const baseUrl = getValidatedBaseUrl(req);

    let stripeAccountId = ownedBusiness.stripe_account_id;

    if (!stripeAccountId) {
      stripeAccountId = await ensureBusinessStripeExpressAccount({
        supabase,
        business: ownedBusiness,
        ownerUserId: user.id,
        ownerEmail: user.email || null,
      });
    }

    const refreshUrl = new URL("/admin/settings", baseUrl);
    refreshUrl.searchParams.set("businessId", ownedBusiness.id);
    refreshUrl.searchParams.set("setup", "stripe");
    refreshUrl.searchParams.set("stripe", "refresh");

    const returnUrl = new URL("/api/stripe/return", baseUrl);
    returnUrl.searchParams.set("businessId", ownedBusiness.id);

    console.info("[stripe/connect] computed redirect URLs", {
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

    return NextResponse.json({
      url: accountLink.url,
      stripeAccountId,
    });
  } catch (error: unknown) {
    const err = error as StripeLikeError;
    const debug = {
      name: err?.name || "Error",
      message: err?.message || "Unknown error",
      type: err?.type,
      code: err?.code,
      statusCode: err?.statusCode,
      rawMessage:
        typeof err?.raw === "object" &&
        err?.raw !== null &&
        "message" in err.raw
          ? (err.raw as { message?: string }).message
          : undefined,
    };

    console.error("[stripe/connect] failed", {
      name: debug.name,
      message: debug.message,
      type: debug.type,
      code: debug.code,
      statusCode: debug.statusCode,
      rawMessage: debug.rawMessage,
    });

    return NextResponse.json(
      {
        error: "Failed to start Stripe onboarding",
        debug: isDev
          ? {
              name: debug.name,
              message: debug.message,
              type: debug.type,
              code: debug.code,
              statusCode: debug.statusCode,
              rawMessage: debug.rawMessage,
            }
          : undefined,
      },
      { status: 500 }
    );
  }
}
