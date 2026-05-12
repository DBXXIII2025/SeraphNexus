import {
  canAccessPlanFeature,
  getPlanDefinition,
  getPlanLimit,
  normalizeBusinessPlan,
  type PlanFeature,
  type PlanLimitKey,
  type PlanTier,
} from "@/lib/planConfig";

export type PlanUsageSnapshot = Partial<Record<PlanLimitKey, number>>;

export type PlanGateResult = {
  allowed: boolean;
  plan: PlanTier;
  requiredPlan: PlanTier | null;
  message: string | null;
};

export type PlanLimitResult = {
  allowed: boolean;
  plan: PlanTier;
  limitKey: PlanLimitKey;
  current: number;
  limit: number | null;
  message: string | null;
};

export type UpgradeTrigger = {
  id: string;
  title: string;
  detail: string;
  href: string;
};

const FEATURE_REQUIREMENTS: Record<PlanFeature, PlanTier> = {
  stripe_payments: "starter",
  publish_business: "starter",
  full_messaging: "starter",
  promo_codes: "pro",
  basic_analytics: "pro",
  standard_customization: "starter",
  advanced_analytics: "elite",
  automation: "elite",
  priority_listing: "elite",
  team_roles: "elite",
  advanced_customization: "elite",
  advanced_messaging: "elite",
  advanced_payments: "elite",
  lead_capture: "starter",
  branding_customization: "pro",
  remove_branding: "pro",
};

const LIMIT_LABELS: Record<PlanLimitKey, string> = {
  max_businesses: "businesses",
  max_listings: "listings",
  max_services: "services",
  max_products: "products",
  max_uploads: "uploads",
  max_transactions: "bookings and orders",
  max_message_threads: "message threads",
};

function pluralize(label: string, count: number) {
  if (count === 1) {
    return label.replace(/s$/, "");
  }

  return label;
}

export function getRequiredPlanForFeature(feature: PlanFeature) {
  return FEATURE_REQUIREMENTS[feature];
}

export function getFeatureGate(
  plan: unknown,
  feature: PlanFeature,
  customMessage?: string
): PlanGateResult {
  const normalizedPlan = normalizeBusinessPlan(plan);
  const allowed = canAccessPlanFeature(normalizedPlan, feature);
  const requiredPlan = allowed ? null : getRequiredPlanForFeature(feature);

  return {
    allowed,
    plan: normalizedPlan,
    requiredPlan,
    message:
      allowed
        ? null
        : customMessage ||
          `${getPlanDefinition(normalizedPlan).label} does not include this feature. Upgrade to ${requiredPlan === "elite" ? "Elite" : "Pro or Elite"}.`,
  };
}

export function getUsageLimitResult(args: {
  plan: unknown;
  limitKey: PlanLimitKey;
  current: number;
  customMessage?: string;
}): PlanLimitResult {
  const normalizedPlan = normalizeBusinessPlan(args.plan);
  const limit = getPlanLimit(normalizedPlan, args.limitKey);
  const allowed = limit === null ? true : args.current < limit;
  const label = LIMIT_LABELS[args.limitKey];

  return {
    allowed,
    plan: normalizedPlan,
    limitKey: args.limitKey,
    current: args.current,
    limit,
    message:
      allowed
        ? null
        : args.customMessage ||
          `${getPlanDefinition(normalizedPlan).label} allows up to ${limit} ${pluralize(
            label,
            limit || 0
          )}. Upgrade to ${
            args.limitKey === "max_businesses" ? "Pro or Elite" : "Pro or Elite"
          } for more capacity.`,
  };
}

export function getUpgradeTriggers(args: {
  plan: unknown;
  usage: PlanUsageSnapshot;
}) {
  const normalizedPlan = normalizeBusinessPlan(args.plan);
  const triggers: UpgradeTrigger[] = [];

  (Object.keys(LIMIT_LABELS) as PlanLimitKey[]).forEach((limitKey) => {
    const limit = getPlanLimit(normalizedPlan, limitKey);
    const current = Number(args.usage[limitKey] || 0);

    if (limit === null || limit <= 0) {
      return;
    }

    if (current >= limit) {
      triggers.push({
        id: `${limitKey}-reached`,
        title: `${LIMIT_LABELS[limitKey]} limit reached`,
        detail: `${getPlanDefinition(normalizedPlan).label} allows up to ${limit} ${LIMIT_LABELS[limitKey]}. Upgrade to unlock more capacity.`,
        href: "/admin/upgrade",
      });
      return;
    }

    if (current >= Math.max(1, Math.floor(limit * 0.7))) {
      triggers.push({
        id: `${limitKey}-near`,
        title: `Approaching ${LIMIT_LABELS[limitKey]} limit`,
        detail: `You are using ${current} of ${limit} ${LIMIT_LABELS[limitKey]}. Upgrade before this workspace hits the cap.`,
        href: "/admin/upgrade",
      });
    }
  });

  if (normalizedPlan === "starter") {
    triggers.push({
      id: "starter-upgrade",
      title: "Upgrade from Starter for lower fees and more capacity",
      detail:
        "Starter Access keeps core commerce live, but Pro unlocks promo codes, analytics, lower fees, and much larger workspace limits.",
      href: "/admin/upgrade",
    });
  } else if (normalizedPlan === "pro") {
    triggers.push({
      id: "elite-upgrade",
      title: "Unlock Elite automation and advanced analytics",
      detail:
        "Elite adds automation, advanced analytics, priority listing, advanced messaging, and team-ready controls.",
      href: "/admin/upgrade",
    });
  }

  return triggers;
}
