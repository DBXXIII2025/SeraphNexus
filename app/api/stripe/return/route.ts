import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getIsPlatformAdminForUserId } from "@/lib/platformAdmin";
import { getPaymentReadiness } from "@/lib/paymentReadiness";
import { stripe } from "@/lib/stripe";
import { getStripeConnectAppUrl } from "@/lib/appUrl";

export const runtime = "nodejs";

type BusinessRow = {
  id: string;
  owner_id: string;
  stripe_account_id: string | null;
};

function buildSettingsRedirect(
  req: Request,
  businessId: string,
  state: string,
  message?: string
) {
  const url = new URL("/admin/settings", getStripeConnectAppUrl(req));
  url.searchParams.set("businessId", businessId);
  url.searchParams.set("setup", "stripe");
  url.searchParams.set("stripe", state);

  if (message) {
    url.searchParams.set("message", message);
  }

  return NextResponse.redirect(url);
}

export async function GET(req: Request) {
  try {
    const requestUrl = new URL(req.url);
    const businessId = requestUrl.searchParams.get("businessId");

    if (!businessId) {
      return NextResponse.redirect(
        new URL(
          "/admin/settings?stripe=error&message=Missing%20businessId",
          getStripeConnectAppUrl(req)
        )
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return buildSettingsRedirect(req, businessId, "error", "Unauthorized");
    }

    const isPlatformAdmin = await getIsPlatformAdminForUserId(user.id);

    if (isPlatformAdmin) {
      return NextResponse.redirect(new URL("/admin/platform", getStripeConnectAppUrl(req)));
    }

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, owner_id, stripe_account_id")
      .eq("id", businessId)
      .maybeSingle();

    if (businessError) {
      return buildSettingsRedirect(
        req,
        businessId,
        "error",
        businessError.message
      );
    }

    const ownedBusiness = business as BusinessRow | null;

    if (!ownedBusiness) {
      return buildSettingsRedirect(req, businessId, "error", "Business not found");
    }

    if (ownedBusiness.owner_id !== user.id) {
      return buildSettingsRedirect(req, businessId, "error", "Forbidden");
    }

    if (!ownedBusiness.stripe_account_id) {
      return buildSettingsRedirect(
        req,
        businessId,
        "error",
        "Business has no connected Stripe account"
      );
    }

    const account = await stripe.accounts.retrieve(
      ownedBusiness.stripe_account_id
    );

    const onboardingComplete = account.details_submitted ?? false;
    const chargesEnabled = account.charges_enabled ?? false;
    const payoutsEnabled = account.payouts_enabled ?? false;

    const { error: updateError } = await supabase
      .from("businesses")
      .update({
        stripe_onboarding_complete: onboardingComplete,
        stripe_charges_enabled: chargesEnabled,
        stripe_payouts_enabled: payoutsEnabled,
      })
      .eq("id", ownedBusiness.id)
      .eq("owner_id", user.id);

    if (updateError) {
      return buildSettingsRedirect(
        req,
        businessId,
        "error",
        updateError.message
      );
    }

    const readiness = getPaymentReadiness({
      stripe_account_id: ownedBusiness.stripe_account_id,
      stripe_onboarding_complete: onboardingComplete,
      stripe_charges_enabled: chargesEnabled,
      stripe_payouts_enabled: payoutsEnabled,
    });

    return buildSettingsRedirect(
      req,
      businessId,
      readiness.status === "payment_ready" ? "connected" : "refresh"
    );
  } catch (err: unknown) {
    console.error("STRIPE RETURN ERROR:", err);
    const requestUrl = new URL(req.url);
    const businessId = requestUrl.searchParams.get("businessId");

    if (!businessId) {
      return NextResponse.redirect(
        new URL(
          `/admin/settings?stripe=error&message=${encodeURIComponent(
            err instanceof Error
              ? err.message
              : "Failed to refresh Stripe account status"
          )}`,
          getStripeConnectAppUrl(req)
        )
      );
    }

    return buildSettingsRedirect(
      req,
      businessId,
      "error",
      err instanceof Error
        ? err.message
        : "Failed to refresh Stripe account status"
    );
  }
}
