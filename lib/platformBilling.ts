import { stripe } from "@/lib/stripe";
import {
  DEFAULT_PLATFORM_SETTINGS,
  getPlatformSettings,
  type PlatformSettings,
} from "@/lib/platformSettings";

export type ManagedBillingPlan = "pro" | "elite";

export type ManagedPlanPricing = {
  plan: ManagedBillingPlan;
  monthlyPriceCents: number;
  monthlyPriceLabel: string;
  active: boolean;
  stripePriceId: string | null;
  stripeProductId: string | null;
};

function defaultEnvPriceId(plan: ManagedBillingPlan) {
  if (plan === "pro") {
    return (
      process.env.STRIPE_PRO_PRICE_ID ||
      process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ||
      process.env.STRIPE_GROWTH_PRICE_ID ||
      null
    );
  }

  return (
    process.env.STRIPE_ELITE_PRICE_ID ||
    process.env.NEXT_PUBLIC_STRIPE_ELITE_PRICE_ID ||
    null
  );
}

export function formatMonthlyPriceLabel(amountCents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Math.max(0, amountCents) / 100) + "/month";
}

export function getManagedPlanPricingFromSettings(
  settings: PlatformSettings,
  plan: ManagedBillingPlan
): ManagedPlanPricing {
  if (plan === "pro") {
    return {
      plan,
      monthlyPriceCents: settings.pro_monthly_price_cents,
      monthlyPriceLabel: formatMonthlyPriceLabel(settings.pro_monthly_price_cents),
      active: settings.pro_price_active,
      stripePriceId: settings.pro_stripe_price_id || defaultEnvPriceId(plan),
      stripeProductId: settings.pro_stripe_product_id || null,
    };
  }

  return {
    plan,
    monthlyPriceCents: settings.elite_monthly_price_cents,
    monthlyPriceLabel: formatMonthlyPriceLabel(settings.elite_monthly_price_cents),
    active: settings.elite_price_active,
    stripePriceId: settings.elite_stripe_price_id || defaultEnvPriceId(plan),
    stripeProductId: settings.elite_stripe_product_id || null,
  };
}

export async function getManagedPlanPricing(plan: ManagedBillingPlan) {
  const settings = await getPlatformSettings();
  return getManagedPlanPricingFromSettings(settings, plan);
}

export async function getStripePriceIdForManagedPlan(plan: ManagedBillingPlan) {
  const pricing = await getManagedPlanPricing(plan);

  if (!pricing.active) {
    throw new Error(
      `${plan === "pro" ? "Pro" : "Elite"} billing is currently disabled by the platform admin.`
    );
  }

  if (!pricing.stripePriceId) {
    throw new Error(
      `${plan === "pro" ? "Pro" : "Elite"} billing is not fully configured yet.`
    );
  }

  return pricing.stripePriceId;
}

export function getPlatformStripeEnvironmentSummary() {
  const secretKey = process.env.STRIPE_SECRET_KEY || "";
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
  const configured = secretKey.startsWith("sk_test_") || secretKey.startsWith("sk_live_");
  const mode = secretKey.startsWith("sk_live_") ? "live" : "test";

  return {
    configured,
    mode,
    hasPublishableKey:
      publishableKey.startsWith("pk_test_") || publishableKey.startsWith("pk_live_"),
    hasWebhookSecret: webhookSecret.startsWith("whsec_"),
    dashboardUrl:
      mode === "live"
        ? "https://dashboard.stripe.com"
        : "https://dashboard.stripe.com/test",
  };
}

async function ensurePlanProduct(
  plan: ManagedBillingPlan,
  existingProductId: string | null
) {
  if (existingProductId) {
    try {
      const product = await stripe.products.retrieve(existingProductId);
      if (!("deleted" in product) || !product.deleted) {
        return product.id;
      }
    } catch {}
  }

  const product = await stripe.products.create({
    name: `Seraph Nexus ${plan === "pro" ? "Pro" : "Elite"} Monthly`,
    description: `Platform-managed ${plan} monthly plan for Seraph Nexus.`,
    metadata: {
      managed_plan: plan,
      source: "platform_settings",
    },
  });

  return product.id;
}

async function reuseCompatiblePrice(
  stripePriceId: string | null,
  productId: string,
  amountCents: number
) {
  if (!stripePriceId) {
    return null;
  }

  try {
    const price = await stripe.prices.retrieve(stripePriceId);
    if (
      price.active &&
      price.currency === "usd" &&
      price.recurring?.interval === "month" &&
      price.unit_amount === amountCents &&
      price.product === productId
    ) {
      return price.id;
    }
  } catch {}

  return null;
}

export async function ensureManagedPlanStripePrice(args: {
  plan: ManagedBillingPlan;
  amountCents: number;
  existingPriceId: string | null;
  existingProductId: string | null;
}) {
  const productId = await ensurePlanProduct(args.plan, args.existingProductId);
  const reusablePriceId = await reuseCompatiblePrice(
    args.existingPriceId,
    productId,
    args.amountCents
  );

  if (reusablePriceId) {
    return {
      stripePriceId: reusablePriceId,
      stripeProductId: productId,
    };
  }

  const createdPrice = await stripe.prices.create({
    unit_amount: args.amountCents,
    currency: "usd",
    recurring: {
      interval: "month",
    },
    product: productId,
    nickname: `Seraph Nexus ${args.plan === "pro" ? "Pro" : "Elite"} Monthly`,
    metadata: {
      managed_plan: args.plan,
      source: "platform_settings",
    },
  });

  if (args.existingPriceId && args.existingPriceId !== createdPrice.id) {
    try {
      await stripe.prices.update(args.existingPriceId, {
        active: false,
      });
    } catch {}
  }

  return {
    stripePriceId: createdPrice.id,
    stripeProductId: productId,
  };
}

export async function getManagedPricingSnapshot() {
  const settings = await getPlatformSettings();
  return {
    pro: getManagedPlanPricingFromSettings(settings, "pro"),
    elite: getManagedPlanPricingFromSettings(settings, "elite"),
    defaults: {
      pro: getManagedPlanPricingFromSettings(DEFAULT_PLATFORM_SETTINGS, "pro"),
      elite: getManagedPlanPricingFromSettings(DEFAULT_PLATFORM_SETTINGS, "elite"),
    },
  };
}
