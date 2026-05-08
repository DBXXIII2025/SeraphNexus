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

export type ManagedStripePriceDetails = {
  id: string;
  unitAmountCents: number | null;
  unitAmountLabel: string;
  active: boolean;
  livemode: boolean;
  currency: string;
  interval: string | null;
  productId: string | null;
};

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
      stripePriceId: settings.pro_stripe_price_id,
      stripeProductId: settings.pro_stripe_product_id || null,
    };
  }

  return {
    plan,
    monthlyPriceCents: settings.elite_monthly_price_cents,
    monthlyPriceLabel: formatMonthlyPriceLabel(settings.elite_monthly_price_cents),
    active: settings.elite_price_active,
    stripePriceId: settings.elite_stripe_price_id,
    stripeProductId: settings.elite_stripe_product_id || null,
  };
}

export async function getManagedPlanPricing(plan: ManagedBillingPlan) {
  const settings = await getPlatformSettings();
  return getManagedPlanPricingFromSettings(settings, plan);
}

async function getStripePriceDetails(priceId: string | null): Promise<ManagedStripePriceDetails | null> {
  if (!priceId) {
    return null;
  }

  try {
    const price = await stripe.prices.retrieve(priceId);
    const unitAmountCents = typeof price.unit_amount === "number" ? price.unit_amount : null;

    return {
      id: price.id,
      unitAmountCents,
      unitAmountLabel: formatMonthlyPriceLabel(unitAmountCents || 0),
      active: price.active,
      livemode: price.livemode,
      currency: price.currency,
      interval: price.recurring?.interval || null,
      productId: typeof price.product === "string" ? price.product : null,
    };
  } catch {
    return null;
  }
}

export async function getManagedPlanPricingState(plan: ManagedBillingPlan) {
  const pricing = await getManagedPlanPricing(plan);
  const stripePrice = await getStripePriceDetails(pricing.stripePriceId);

  return {
    ...pricing,
    stripePrice,
  };
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
  existingProductId: string | null,
  selectedProductId?: string | null
) {
  const normalizedSelectedProductId = selectedProductId?.trim() || null;

  if (normalizedSelectedProductId) {
    const selectedProduct = await stripe.products.retrieve(normalizedSelectedProductId);
    if ("deleted" in selectedProduct && selectedProduct.deleted) {
      throw new Error(
        `${plan === "pro" ? "Pro" : "Elite"} selected Stripe product must be an active product.`
      );
    }

    return selectedProduct.id;
  }

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
  selectedPriceId?: string | null;
  selectedProductId?: string | null;
}) {
  const selectedPriceId = args.selectedPriceId?.trim() || null;
  if (selectedPriceId) {
    const selectedPrice = await stripe.prices.retrieve(selectedPriceId);
    if (
      !selectedPrice.active ||
      selectedPrice.currency !== "usd" ||
      selectedPrice.recurring?.interval !== "month"
    ) {
      throw new Error(
        `${args.plan === "pro" ? "Pro" : "Elite"} selected Stripe price must be an active USD monthly recurring price.`
      );
    }

    return {
      stripePriceId: selectedPrice.id,
      stripeProductId:
        typeof selectedPrice.product === "string" ? selectedPrice.product : null,
      amountCents:
        typeof selectedPrice.unit_amount === "number"
          ? selectedPrice.unit_amount
          : args.amountCents,
    };
  }

  const productId = await ensurePlanProduct(
    args.plan,
    args.existingProductId,
    args.selectedProductId
  );
  const reusablePriceId = await reuseCompatiblePrice(
    args.existingPriceId,
    productId,
    args.amountCents
  );

  if (reusablePriceId) {
    return {
      stripePriceId: reusablePriceId,
      stripeProductId: productId,
      amountCents: args.amountCents,
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

  return {
    stripePriceId: createdPrice.id,
    stripeProductId: productId,
    amountCents: args.amountCents,
  };
}

export async function getManagedPricingSnapshot() {
  const settings = await getPlatformSettings();
  return {
    settings,
    pro: getManagedPlanPricingFromSettings(settings, "pro"),
    elite: getManagedPlanPricingFromSettings(settings, "elite"),
    defaults: {
      pro: getManagedPlanPricingFromSettings(DEFAULT_PLATFORM_SETTINGS, "pro"),
      elite: getManagedPlanPricingFromSettings(DEFAULT_PLATFORM_SETTINGS, "elite"),
    },
  };
}
