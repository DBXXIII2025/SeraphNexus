import { normalizeAccessPlan, type AccessPlan } from "@/lib/accessPlan";

export type PlanTier = AccessPlan;
export type LegacyPlanTier = "basic" | "growth";
export type StoredBusinessPlan = PlanTier | LegacyPlanTier | "free" | "trial";

export type PlanFeature =
  | "stripe_payments"
  | "publish_business"
  | "full_messaging"
  | "promo_codes"
  | "basic_analytics"
  | "standard_customization"
  | "advanced_analytics"
  | "automation"
  | "priority_listing"
  | "team_roles"
  | "advanced_customization"
  | "advanced_messaging"
  | "advanced_payments"
  | "lead_capture"
  | "branding_customization"
  | "remove_branding";

export type PlanLimitKey =
  | "max_businesses"
  | "max_listings"
  | "max_services"
  | "max_products"
  | "max_uploads"
  | "max_transactions"
  | "max_message_threads";

type PlanLimits = {
  max_businesses: number | null;
  max_listings: number | null;
  max_services: number | null;
  max_products: number | null;
  max_uploads: number | null;
  max_transactions: number | null;
  max_message_threads: number | null;
};

type PlanDefinition = {
  tier: PlanTier;
  label: string;
  monthlyPriceLabel: string;
  transactionFeeRate: number;
  description: string;
  features: PlanFeature[];
  highlights: string[];
  limits: PlanLimits;
};

const PLAN_ORDER: Record<PlanTier, number> = {
  inactive: 0,
  starter: 1,
  pro: 2,
  elite: 3,
};

export const PLAN_DEFINITIONS: Record<PlanTier, PlanDefinition> = {
  inactive: {
    tier: "inactive",
    label: "Inactive",
    monthlyPriceLabel: "$0/month",
    transactionFeeRate: 0.18,
    description: "Restricted account state used only when workspace access is disabled.",
    features: [],
    highlights: [
      "Access disabled",
      "No operational access until restored",
      "Platform admin intervention required",
    ],
    limits: {
      max_businesses: 0,
      max_listings: 0,
      max_services: 0,
      max_products: 0,
      max_uploads: 0,
      max_transactions: 0,
      max_message_threads: 0,
    },
  },
  starter: {
    tier: "starter",
    label: "Starter Access",
    monthlyPriceLabel: "Included",
    transactionFeeRate: 0.18,
    description:
      "Starter workspace access for launching and operating a business with the core Seraph Nexus commerce stack.",
    features: [
      "stripe_payments",
      "publish_business",
      "full_messaging",
      "standard_customization",
      "lead_capture",
    ],
    highlights: [
      "18% platform fee",
      "Create, publish, take payments, and receive customer messages",
      "5 listings and 20 image uploads for a compact launch-ready workspace",
      "Upgrade for promo codes, analytics, lower fees, and premium controls",
    ],
    limits: {
      max_businesses: 1,
      max_listings: 5,
      max_services: 5,
      max_products: 5,
      max_uploads: 20,
      max_transactions: null,
      max_message_threads: null,
    },
  },
  pro: {
    tier: "pro",
    label: "Pro",
    monthlyPriceLabel: "$19/month",
    transactionFeeRate: 0.12,
    description: "Lower fees with stronger growth tooling and more operational headroom.",
    features: [
      "stripe_payments",
      "publish_business",
      "full_messaging",
      "promo_codes",
      "basic_analytics",
      "standard_customization",
      "lead_capture",
      "branding_customization",
      "remove_branding",
    ],
    highlights: [
      "12% platform fee",
      "Promo codes, analytics, and upgraded workspace controls",
      "50 listings and 200 uploads for scaling catalog depth",
      "Up to 2 businesses",
    ],
    limits: {
      max_businesses: 2,
      max_listings: 50,
      max_services: 50,
      max_products: 50,
      max_uploads: 200,
      max_transactions: null,
      max_message_threads: null,
    },
  },
  elite: {
    tier: "elite",
    label: "Elite",
    monthlyPriceLabel: "$49/month",
    transactionFeeRate: 0.05,
    description: "Best economics with the full premium operating stack for scaling businesses.",
    features: [
      "stripe_payments",
      "publish_business",
      "full_messaging",
      "promo_codes",
      "basic_analytics",
      "standard_customization",
      "advanced_analytics",
      "automation",
      "priority_listing",
      "team_roles",
      "advanced_customization",
      "advanced_messaging",
      "advanced_payments",
      "lead_capture",
      "branding_customization",
      "remove_branding",
    ],
    highlights: [
      "5% platform fee",
      "Automation, advanced analytics, and AI-assisted operations",
      "Priority explore boost and advanced customization",
      "Unlimited businesses, listings, and uploads",
    ],
    limits: {
      max_businesses: null,
      max_listings: null,
      max_services: null,
      max_products: null,
      max_uploads: null,
      max_transactions: null,
      max_message_threads: null,
    },
  },
};

export function isPlanTier(value: unknown): value is PlanTier {
  return (
    value === "inactive" ||
    value === "starter" ||
    value === "pro" ||
    value === "elite"
  );
}

export function isStoredBusinessPlan(
  value: unknown
): value is StoredBusinessPlan {
  return (
    value === "free" ||
    value === "inactive" ||
    value === "trial" ||
    value === "starter" ||
    value === "pro" ||
    value === "elite" ||
    value === "basic" ||
    value === "growth"
  );
}

export function normalizeBusinessPlan(value: unknown): PlanTier {
  return normalizeAccessPlan(value);
}

export function getPlanDefinition(value: unknown) {
  return PLAN_DEFINITIONS[normalizeBusinessPlan(value)];
}

export function getPlanTierLabel(value: unknown) {
  return getPlanDefinition(value).label;
}

export function getPlatformFeePercent(value: unknown) {
  return getPlanDefinition(value).transactionFeeRate;
}

export function getPlatformFeeLabel(value: unknown) {
  return `${Math.round(getPlatformFeePercent(value) * 100)}%`;
}

export function getNetPayoutCents(totalCents: number, feeCents: number) {
  return Math.max(0, totalCents - feeCents);
}

export function canAccessPlanFeature(plan: unknown, feature: PlanFeature) {
  return getPlanDefinition(plan).features.includes(feature);
}

export function getPlanLimit(plan: unknown, key: PlanLimitKey) {
  return getPlanDefinition(plan).limits[key];
}

export function comparePlans(currentPlan: unknown, requiredPlan: PlanTier) {
  return (
    PLAN_ORDER[normalizeBusinessPlan(currentPlan)] >= PLAN_ORDER[requiredPlan]
  );
}

export function canUseAI(plan: unknown) {
  return canAccessPlanFeature(plan, "automation");
}

export function canCreatePromoCodes(plan: unknown) {
  return canAccessPlanFeature(plan, "promo_codes");
}

export function canUseAdvancedAnalytics(plan: unknown) {
  return canAccessPlanFeature(plan, "advanced_analytics");
}

export function canRemoveBranding(plan: unknown) {
  return canAccessPlanFeature(plan, "remove_branding");
}

export function canUseAdvancedCustomization(plan: unknown) {
  return canAccessPlanFeature(plan, "advanced_customization");
}

export function getMaxListings(plan: unknown) {
  return getPlanLimit(plan, "max_listings");
}

export function getMaxUploads(plan: unknown) {
  return getPlanLimit(plan, "max_uploads");
}
