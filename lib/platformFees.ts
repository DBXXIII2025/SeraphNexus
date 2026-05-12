import {
  getPlanDefinition,
  normalizeBusinessPlan,
  type PlanTier,
} from "@/lib/planConfig";

export type PlatformFeeQuote = {
  plan: PlanTier;
  basisPoints: number;
  rate: number;
  label: string;
  source: "plan_config";
};

function clampBasisPoints(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(10000, Math.max(0, Math.round(parsed)));
}

export function formatPlatformFeeBpsLabel(basisPoints: number) {
  const percent = clampBasisPoints(basisPoints, 0) / 100;
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(2)}%`;
}

export function calculatePlatformFeeCents(totalCents: number, basisPoints: number) {
  const safeTotal = Math.max(0, Math.round(Number(totalCents) || 0));
  return Math.round((safeTotal * clampBasisPoints(basisPoints, 0)) / 10000);
}

export async function getConfiguredPlatformFee(plan: unknown): Promise<PlatformFeeQuote> {
  const normalizedPlan = normalizeBusinessPlan(plan);
  const definition = getPlanDefinition(normalizedPlan);
  const basisPoints = clampBasisPoints(
    Math.round(definition.transactionFeeRate * 10000),
    0
  );

  return {
    plan: normalizedPlan,
    basisPoints,
    rate: basisPoints / 10000,
    label: formatPlatformFeeBpsLabel(basisPoints),
    source: "plan_config",
  };
}
