import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/appUrl";
import { resolveAccessPlanForBusiness } from "@/lib/accessGrants";
import { canAccessPlanFeature } from "@/lib/planConfig";
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

function isNonEmpty(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

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
  const appUrl = getAppUrl(req);
  const parsed = new URL(appUrl);
  return parsed.origin;
}

export async function POST(req: Request) {
  const isDev = process.env.NODE_ENV !== "production";

  try {
    console.log("[stripe/connect] route start");

    const body = (await req.json().catch(() => null)) as ConnectPayload | null;
    const businessId = body?.businessId?.trim();

    console.log("[stripe/connect] received businessId:", businessId || null);

    if (!businessId) {
      return NextResponse.json(
        { error: "Missing businessId" },
        { status: 400 }
      );
    }

    const stripeKey = validateStripeSecretKey();
    console.log("[stripe/connect] stripe key loaded:", Boolean(stripeKey));
    console.log("[stripe/connect] stripe key prefix:", stripeKey.slice(0, 7));

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    console.log("[stripe/connect] authenticated user id:", user?.id || null);

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .maybeSingle();

    console.log("[stripe/connect] business found:", Boolean(business));

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

    if (!canAccessPlanFeature(effectivePlan, "stripe_payments")) {
      return NextResponse.json(
        { error: "Stripe payments require a Pro or Elite plan." },
        { status: 403 }
      );
    }

    console.log(
      "[stripe/connect] current business.stripe_account_id:",
      ownedBusiness.stripe_account_id || null
    );
    console.log(
      "[stripe/connect] business.name exists:",
      isNonEmpty(ownedBusiness.name)
    );
    console.log(
      "[stripe/connect] business.email exists:",
      isNonEmpty(ownedBusiness.email)
    );

    const baseUrl = getValidatedBaseUrl(req);
    console.log("[stripe/connect] baseUrl:", baseUrl);

    let stripeAccountId = ownedBusiness.stripe_account_id;

    if (!stripeAccountId) {
      const accountPayload: {
        type: "standard";
        email?: string;
        metadata: {
          business_id: string;
          owner_user_id: string;
        };
        business_profile?: {
          name?: string;
        };
      } = {
        type: "standard",
        metadata: {
          business_id: ownedBusiness.id,
          owner_user_id: user.id,
        },
      };

      const accountEmail = ownedBusiness.email || user.email || undefined;
      if (accountEmail) {
        accountPayload.email = accountEmail;
      }

      if (isNonEmpty(ownedBusiness.name)) {
        accountPayload.business_profile = {
          name: ownedBusiness.name.trim(),
        };
      }

      console.log("[stripe/connect] before stripe.accounts.create");
      const account = await stripe.accounts.create(accountPayload);
      console.log("[stripe/connect] after stripe.accounts.create:", account.id);

      stripeAccountId = account.id;

      console.log("[stripe/connect] before DB update");
      const { error: updateError } = await supabase
        .from("businesses")
        .update({
          stripe_account_id: stripeAccountId,
          stripe_onboarding_complete: false,
          stripe_charges_enabled: false,
          stripe_payouts_enabled: false,
        })
        .eq("id", ownedBusiness.id)
        .eq("owner_id", user.id);

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        );
      }
      console.log("[stripe/connect] after DB update");
    }

    const refreshUrl = new URL("/admin/settings", baseUrl);
    refreshUrl.searchParams.set("businessId", ownedBusiness.id);
    refreshUrl.searchParams.set("setup", "stripe");
    refreshUrl.searchParams.set("stripe", "refresh");

    const returnUrl = new URL("/api/stripe/return", baseUrl);
    returnUrl.searchParams.set("businessId", ownedBusiness.id);

    console.log("[stripe/connect] refresh_url:", refreshUrl.toString());
    console.log("[stripe/connect] return_url:", returnUrl.toString());

    console.log("[stripe/connect] before stripe.accountLinks.create");
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl.toString(),
      return_url: returnUrl.toString(),
      type: "account_onboarding",
    });
    console.log("[stripe/connect] after stripe.accountLinks.create: success");

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

    console.error("[stripe/connect] full error object:", err);
    console.error("[stripe/connect] error name:", debug.name);
    console.error("[stripe/connect] error message:", debug.message);
    console.error("[stripe/connect] error type:", debug.type);
    console.error("[stripe/connect] error code:", debug.code);
    console.error("[stripe/connect] error statusCode:", debug.statusCode);
    console.error("[stripe/connect] error raw.message:", debug.rawMessage);

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
