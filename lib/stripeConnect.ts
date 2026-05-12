import { stripe } from "@/lib/stripe";
import { getAppUrl } from "@/lib/appUrl";
import { getCanonicalPublicBusinessRoute } from "@/lib/publicBusinessRoutes";
import type Stripe from "stripe";

type StripeManagedBusiness = {
  id: string;
  name: string | null;
  owner_id: string;
  slug?: string | null;
  description?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  business_type?: string | null;
  stripe_account_id: string | null;
};

function isNonEmpty(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function trimOrNull(value: string | null | undefined) {
  return isNonEmpty(value) ? String(value).trim() : null;
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function normalizeSupportPhone(value: string | null | undefined) {
  const raw = trimOrNull(value);
  if (!raw) {
    return undefined;
  }

  const digits = raw.replace(/\D+/g, "");
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  if (raw.startsWith("+") && digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }

  return undefined;
}

function buildBusinessUrl(args: {
  business: StripeManagedBusiness;
  baseUrl?: string | null;
}) {
  const website = trimOrNull(args.business.website);
  if (website) {
    try {
      return new URL(website).toString();
    } catch {
      // Fall back to the canonical public route if the stored website is not absolute.
    }
  }

  const slug = trimOrNull(args.business.slug);
  if (!slug || !args.baseUrl) {
    return null;
  }

  const publicRoute = getCanonicalPublicBusinessRoute(
    args.business.business_type || null,
    slug
  );

  return new URL(publicRoute.href, args.baseUrl).toString();
}

function buildBusinessProfilePayload(args: {
  business: StripeManagedBusiness;
  ownerEmail: string | null;
  baseUrl?: string | null;
}) {
  const name = trimOrNull(args.business.name);
  const description = trimOrNull(args.business.description);
  const supportEmail =
    trimOrNull(args.business.email) || trimOrNull(args.ownerEmail) || undefined;
  const supportPhone = normalizeSupportPhone(args.business.phone);
  const url = buildBusinessUrl({
    business: args.business,
    baseUrl: args.baseUrl || null,
  });

  const productDescription = description
    ? truncate(description, 240)
    : name
      ? `${name} accepts bookings and payments through Seraph Nexus.`
      : "This business accepts bookings and payments through Seraph Nexus.";

  const profile: Stripe.AccountCreateParams.BusinessProfile = {};

  if (name) {
    profile.name = name;
  }

  if (url) {
    profile.url = url;
  }

  if (productDescription) {
    profile.product_description = productDescription;
  }

  if (supportEmail) {
    profile.support_email = supportEmail;
  }

  if (supportPhone) {
    profile.support_phone = supportPhone;
  }

  return Object.keys(profile).length > 0 ? profile : undefined;
}

function buildCompanyPayload(args: {
  account: Stripe.Account;
  business: StripeManagedBusiness;
}) {
  const name = trimOrNull(args.business.name);
  if (!name || args.account.business_type !== "company") {
    return undefined;
  }

  if (trimOrNull(args.account.company?.name) === name) {
    return undefined;
  }

  return { name };
}

export async function syncBusinessStripeAccountIdentity(args: {
  stripeAccountId: string;
  business: StripeManagedBusiness;
  ownerEmail: string | null;
  baseUrl?: string | null;
}) {
  const account = await stripe.accounts.retrieve(args.stripeAccountId);

  if ("deleted" in account) {
    throw new Error("Stripe account was deleted");
  }

  const businessProfile = buildBusinessProfilePayload({
    business: args.business,
    ownerEmail: args.ownerEmail,
    baseUrl: args.baseUrl || null,
  });
  const company = buildCompanyPayload({
    account,
    business: args.business,
  });

  if (!businessProfile && !company) {
    return account;
  }

  return stripe.accounts.update(args.stripeAccountId, {
    ...(businessProfile ? { business_profile: businessProfile } : {}),
    ...(company ? { company } : {}),
  });
}

export async function ensureBusinessStripeExpressAccount(args: {
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;
  business: StripeManagedBusiness;
  ownerUserId: string;
  ownerEmail: string | null;
  baseUrl?: string | null;
}) {
  if (args.business.stripe_account_id) {
    await syncBusinessStripeAccountIdentity({
      stripeAccountId: args.business.stripe_account_id,
      business: args.business,
      ownerEmail: args.ownerEmail,
      baseUrl: args.baseUrl || getAppUrl(),
    });
    return args.business.stripe_account_id;
  }

  const accountPayload: Stripe.AccountCreateParams = {
    type: "express",
    metadata: {
      business_id: args.business.id,
      owner_user_id: args.ownerUserId,
      business_name: trimOrNull(args.business.name) || "",
      business_slug: trimOrNull(args.business.slug) || "",
    },
  };

  const accountEmail = args.business.email || args.ownerEmail || undefined;
  if (accountEmail) {
    accountPayload.email = accountEmail;
  }

  const businessProfile = buildBusinessProfilePayload({
    business: args.business,
    ownerEmail: args.ownerEmail,
    baseUrl: args.baseUrl || getAppUrl(),
  });
  if (businessProfile) {
    accountPayload.business_profile = businessProfile;
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

  await syncBusinessStripeAccountIdentity({
    stripeAccountId: account.id,
    business: args.business,
    ownerEmail: args.ownerEmail,
    baseUrl: args.baseUrl || getAppUrl(),
  });

  return account.id;
}
