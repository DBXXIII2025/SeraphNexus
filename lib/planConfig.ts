export type PlanTier = "free" | "pro" | "elite";
export type LegacyPlanTier = "basic" | "growth";
export type StoredBusinessPlan = PlanTier | LegacyPlanTier;

export type PlanFeature =
  | "advanced_analytics"
  | "lead_capture"
  | "branding_customization";

type PlanDefinition = {
  tier: PlanTier;
  label: string;
  monthlyPriceLabel: string;
  transactionFeeRate: number;
  description: string;
  features: PlanFeature[];
  highlights: string[];
};

const PLAN_ORDER: Record<PlanTier, number> = {
  free: 0,
  pro: 1,
  elite: 2,
};

export const PLAN_DEFINITIONS: Record<PlanTier, PlanDefinition> = {
  free: {
    tier: "free",
    label: "Free",
    monthlyPriceLabel: "$0/month",
    transactionFeeRate: 0.1,
    description: "Launch with core booking, ordering, and payments tools.",
    features: [],
    highlights: [
      "Core storefront and checkout",
      "Stripe Connect payouts",
      "Basic admin operations",
    ],
  },
  pro: {
    tier: "pro",
    label: "Pro",
    monthlyPriceLabel: "$19/month",
    transactionFeeRate: 0.05,
    description: "Lower fees and unlock more operational visibility.",
    features: ["advanced_analytics", "lead_capture", "branding_customization"],
    highlights: [
      "5% platform fee",
      "Lead capture tools",
      "Advanced analytics and branding controls",
    ],
  },
  elite: {
    tier: "elite",
    label: "Elite",
    monthlyPriceLabel: "$49/month",
    transactionFeeRate: 0.02,
    description: "Lowest fee tier with full access for scaling businesses.",
    features: [
      "advanced_analytics",
      "lead_capture",
      "branding_customization",
    ],
    highlights: [
      "2% platform fee",
      "Full premium feature access",
      "Best net payout on each transaction",
    ],
  },
};

export function isPlanTier(value: unknown): value is PlanTier {
  return value === "free" || value === "pro" || value === "elite";
}

export function isStoredBusinessPlan(
  value: unknown
): value is StoredBusinessPlan {
  return (
    value === "free" ||
    value === "pro" ||
    value === "elite" ||
    value === "basic" ||
    value === "growth"
  );
}

export function normalizeBusinessPlan(value: unknown): PlanTier {
  if (value === "growth") {
    return "pro";
  }

  if (value === "basic") {
    return "free";
  }

  return isPlanTier(value) ? value : "free";
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

export function comparePlans(currentPlan: unknown, requiredPlan: PlanTier) {
  return (
    PLAN_ORDER[normalizeBusinessPlan(currentPlan)] >= PLAN_ORDER[requiredPlan]
  );
}
