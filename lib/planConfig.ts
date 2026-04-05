import { normalizeAccessPlan, type AccessPlan } from "@/lib/accessPlan";

export type PlanTier = AccessPlan;
export type LegacyPlanTier = "basic" | "growth";
export type StoredBusinessPlan = PlanTier | LegacyPlanTier | "free";

export type PlanFeature =
  | "stripe_payments"
  | "full_messaging"
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
  | "branding_customization";

export type PlanLimitKey =
  | "max_businesses"
  | "max_services"
  | "max_products";

type PlanLimits = {
  max_businesses: number | null;
  max_services: number | null;
  max_products: number | null;
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
  trial: 1,
  pro: 2,
  elite: 3,
};

export const PLAN_DEFINITIONS: Record<PlanTier, PlanDefinition> = {
  inactive: {
    tier: "inactive",
    label: "Inactive",
    monthlyPriceLabel: "$0/month",
    transactionFeeRate: 0.1,
    description: "Restricted account state until trial access or paid billing is enabled.",
    features: [],
    highlights: [
      "Account created but not enabled",
      "No operational access until activation",
      "Upgrade or receive a private trial grant",
    ],
    limits: {
      max_businesses: 1,
      max_services: 1,
      max_products: 1,
    },
  },
  trial: {
    tier: "trial",
    label: "Trial",
    monthlyPriceLabel: "$0/month",
    transactionFeeRate: 0.1,
    description: "Private invite-only trial access for the restricted launch tier.",
    features: [],
    highlights: [
      "Invite-only free access",
      "One business with capped setup",
      "Upgrade to enable payments and the full owner suite",
    ],
    limits: {
      max_businesses: 1,
      max_services: 5,
      max_products: 5,
    },
  },
  pro: {
    tier: "pro",
    label: "Pro",
    monthlyPriceLabel: "$19/month",
    transactionFeeRate: 0.05,
    description: "Lower fees and unlock more operational visibility.",
    features: [
      "stripe_payments",
      "full_messaging",
      "basic_analytics",
      "standard_customization",
      "lead_capture",
      "branding_customization",
    ],
    highlights: [
      "5% platform fee",
      "Stripe payments and full owner messaging",
      "Basic analytics, lead capture, and standard customization",
      "Up to 2 businesses",
    ],
    limits: {
      max_businesses: 2,
      max_services: null,
      max_products: null,
    },
  },
  elite: {
    tier: "elite",
    label: "Elite",
    monthlyPriceLabel: "$49/month",
    transactionFeeRate: 0.02,
    description: "Lowest fee tier with full access for scaling businesses.",
    features: [
      "stripe_payments",
      "full_messaging",
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
    ],
    highlights: [
      "2% platform fee",
      "Automation, advanced analytics, and messaging tools",
      "Priority explore boost and advanced customization",
      "Unlimited businesses with future-ready premium payments",
    ],
    limits: {
      max_businesses: null,
      max_services: null,
      max_products: null,
    },
  },
};

export function isPlanTier(value: unknown): value is PlanTier {
  return (
    value === "inactive" ||
    value === "trial" ||
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
