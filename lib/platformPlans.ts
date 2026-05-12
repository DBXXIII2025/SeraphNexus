import { getPlanDefinition } from "@/lib/planConfig";

export type PlatformCheckoutTier = "pro" | "elite";

export type PlatformPlanCard = {
  id: string;
  name: string;
  subtitle: string;
  monthly_price_cents: number;
  billing_note: string;
  transaction_fee_bps: number;
  feature_bullets: string[];
  badge_text: string | null;
  cta_text: string;
  is_active: boolean;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
  checkout_tier: PlatformCheckoutTier | null;
  is_default: boolean;
};

const PLAN_CONFIG_NOTE_PREFIX = "__SERAPH_PLAN_CONFIG_V2__";

export const DEFAULT_PLATFORM_PRICING_NOTE =
  "Starter Access is included at 18% platform fees. Upgrade to Pro at 12% or Elite at 5% for lower fees and premium tools.";

const DEFAULT_PLATFORM_PLANS: PlatformPlanCard[] = [
  {
    id: "starter",
    name: "Starter Access",
    subtitle:
      "Launch on Seraph Nexus with core checkout, payouts, publishing, and customer messaging.",
    monthly_price_cents: 0,
    billing_note: "Included by default for new workspaces.",
    transaction_fee_bps: 1800,
    feature_bullets: [
      "18% platform fee",
      "Publish, take payments, and operate one compact workspace",
      "Up to 5 listings and 20 images before upgrading",
    ],
    badge_text: "Default",
    cta_text: "Included",
    is_active: true,
    stripe_price_id: null,
    stripe_product_id: null,
    checkout_tier: null,
    is_default: true,
  },
  {
    id: "pro",
    name: "Pro",
    subtitle:
      "Enable payments, full messaging, basic analytics, and standard owner controls.",
    monthly_price_cents: 1900,
    billing_note: "Best for growing businesses that need full operations.",
    transaction_fee_bps: 1200,
    feature_bullets: [
      "12% platform fee",
      "Promo codes, analytics, and upgraded workspace controls",
      "Up to 2 businesses with 50 listings and 200 uploads",
    ],
    badge_text: null,
    cta_text: "Choose Pro",
    is_active: true,
    stripe_price_id: null,
    stripe_product_id: null,
    checkout_tier: "pro",
    is_default: true,
  },
  {
    id: "elite",
    name: "Elite",
    subtitle:
      "Best economics and the full premium operating stack for scaling businesses.",
    monthly_price_cents: 4900,
    billing_note: "Best for scaling operators who want the premium stack.",
    transaction_fee_bps: 500,
    feature_bullets: [
      "5% platform fee",
      "AI assistant, automation, advanced analytics, and advanced messaging",
      "Priority explore boost with unlimited businesses, listings, and uploads",
    ],
    badge_text: null,
    cta_text: "Choose Elite",
    is_active: true,
    stripe_price_id: null,
    stripe_product_id: null,
    checkout_tier: "elite",
    is_default: true,
  },
];

function clampBasisPoints(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.min(10000, Math.round(parsed)));
}

function clampPriceCents(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.round(parsed));
}

function normalizePlanId(value: unknown, fallback: string) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

function normalizeFeatures(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const features = value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 10);

  return features.length > 0 ? features : fallback;
}

function normalizeNullableString(value: unknown) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function normalizeCheckoutTier(value: unknown): PlatformCheckoutTier | null {
  return value === "pro" || value === "elite" ? value : null;
}

function normalizePlanCard(
  input: Partial<PlatformPlanCard> | null | undefined,
  fallback: PlatformPlanCard
): PlatformPlanCard {
  const id = normalizePlanId(input?.id, fallback.id);
  const isDefault =
    id === "starter" || id === "pro" || id === "elite"
      ? true
      : Boolean(input?.is_default);
  const checkoutTier = isDefault
    ? (id === "pro" || id === "elite" ? (id as PlatformCheckoutTier) : null)
    : normalizeCheckoutTier(input?.checkout_tier);
  const enforcedFeeBps =
    id === "starter" || id === "pro" || id === "elite"
      ? Math.round(getPlanDefinition(id).transactionFeeRate * 10000)
      : clampBasisPoints(input?.transaction_fee_bps, fallback.transaction_fee_bps);

  return {
    id,
    name: String(input?.name || "").trim() || fallback.name,
    subtitle: String(input?.subtitle || "").trim() || fallback.subtitle,
    monthly_price_cents: clampPriceCents(input?.monthly_price_cents, fallback.monthly_price_cents),
    billing_note: String(input?.billing_note || "").trim() || fallback.billing_note,
    transaction_fee_bps: enforcedFeeBps,
    feature_bullets: normalizeFeatures(input?.feature_bullets, fallback.feature_bullets),
    badge_text: normalizeNullableString(input?.badge_text),
    cta_text: String(input?.cta_text || "").trim() || fallback.cta_text,
    is_active: input?.is_active !== false,
    stripe_price_id: normalizeNullableString(input?.stripe_price_id),
    stripe_product_id: normalizeNullableString(input?.stripe_product_id),
    checkout_tier: checkoutTier,
    is_default: isDefault,
  };
}

export function getDefaultPlatformPlans() {
  return DEFAULT_PLATFORM_PLANS.map((plan) => ({ ...plan, feature_bullets: [...plan.feature_bullets] }));
}

export function parsePlatformPlanConfig(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw.startsWith(PLAN_CONFIG_NOTE_PREFIX)) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw.slice(PLAN_CONFIG_NOTE_PREFIX.length)) as {
      pricing_note?: unknown;
      plans?: unknown;
    };

    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function normalizePlatformPlans(value: unknown, fallbackPlans?: PlatformPlanCard[]) {
  const defaults = fallbackPlans?.length
    ? fallbackPlans.map((plan) => ({ ...plan, feature_bullets: [...plan.feature_bullets] }))
    : getDefaultPlatformPlans();
  const defaultsById = new Map(defaults.map((plan) => [plan.id, plan]));
  const normalized: PlatformPlanCard[] = [];
  const seenIds = new Set<string>();

  if (Array.isArray(value)) {
    for (const rawPlan of value) {
      const rawObject =
        rawPlan && typeof rawPlan === "object" && !Array.isArray(rawPlan)
          ? (rawPlan as Partial<PlatformPlanCard>)
          : null;
      const fallback = defaultsById.get(normalizePlanId(rawObject?.id, "")) || {
        ...defaults[0],
        id: normalizePlanId(rawObject?.id, `custom-${normalized.length + 1}`),
        name: "Custom plan",
        subtitle: "Add custom pricing and feature bullets.",
        monthly_price_cents: 9900,
        billing_note: "Custom pricing and platform economics.",
        transaction_fee_bps: 300,
        feature_bullets: ["Custom plan feature"],
        badge_text: null,
        cta_text: "Contact Sales",
        is_active: true,
        stripe_price_id: null,
        stripe_product_id: null,
        checkout_tier: null,
        is_default: false,
      };

      const plan = normalizePlanCard(rawObject, fallback);
      if (seenIds.has(plan.id)) {
        continue;
      }
      seenIds.add(plan.id);
      normalized.push(plan);
    }
  }

  for (const defaultPlan of defaults) {
    if (!seenIds.has(defaultPlan.id)) {
      normalized.push(defaultPlan);
      seenIds.add(defaultPlan.id);
    }
  }

  return normalized;
}

export function serializePlatformPlanConfig(args: {
  pricingNote: string;
  plans: PlatformPlanCard[];
}) {
  return `${PLAN_CONFIG_NOTE_PREFIX}${JSON.stringify({
    pricing_note: args.pricingNote,
    plans: args.plans,
  })}`;
}

export function getVisiblePlatformPlans(plans: PlatformPlanCard[]) {
  return plans.filter((plan) => plan.is_active);
}

export function formatPlatformPlanPriceLabel(amountCents: number) {
  return (
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Math.max(0, amountCents) / 100) + "/month"
  );
}
