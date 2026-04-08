import { stripe } from "@/lib/stripe";

type StripeManagedBusiness = {
  id: string;
  name: string | null;
  owner_id: string;
  email?: string | null;
  stripe_account_id: string | null;
};

function isNonEmpty(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

export async function ensureBusinessStripeExpressAccount(args: {
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;
  business: StripeManagedBusiness;
  ownerUserId: string;
  ownerEmail: string | null;
}) {
  if (args.business.stripe_account_id) {
    return args.business.stripe_account_id;
  }

  const accountPayload: {
    type: "express";
    email?: string;
    metadata: {
      business_id: string;
      owner_user_id: string;
    };
    business_profile?: {
      name?: string;
    };
  } = {
    type: "express",
    metadata: {
      business_id: args.business.id,
      owner_user_id: args.ownerUserId,
    },
  };

  const accountEmail = args.business.email || args.ownerEmail || undefined;
  if (accountEmail) {
    accountPayload.email = accountEmail;
  }

  if (isNonEmpty(args.business.name)) {
    accountPayload.business_profile = {
      name: String(args.business.name).trim(),
    };
  }

  const account = await stripe.accounts.create(accountPayload);

  const { error } = await args.supabase
    .from("businesses")
    .update({
      stripe_account_id: account.id,
      stripe_onboarding_complete: false,
      stripe_charges_enabled: false,
      stripe_payouts_enabled: false,
    })
    .eq("id", args.business.id)
    .eq("owner_id", args.ownerUserId);

  if (error) {
    throw new Error(error.message || "Failed to store Stripe account");
  }

  return account.id;
}
