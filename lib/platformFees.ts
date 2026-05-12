import { normalizeBusinessPlan, type PlanTier } from "@/lib/planConfig";
import { getPlatformSettings } from "@/lib/platformSettings";

export type PlatformFeeQuote = {
  plan: PlanTier;
  basisPoints: number;
  rate: number;
  label: string;
  source: "platform_settings";
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
  const settings = await getPlatformSettings();
  const normalizedPlan = normalizeBusinessPlan(plan);
  const basisPoints =
    normalizedPlan === "elite"
      ? clampBasisPoints(settings.elite_transaction_fee_bps, 500)
      : normalizedPlan === "pro"
        ? clampBasisPoints(settings.pro_transaction_fee_bps, 1200)
        : clampBasisPoints(settings.trial_transaction_fee_bps, 1800);

  return {
    plan: normalizedPlan,
    basisPoints,
    rate: basisPoints / 10000,
    label: formatPlatformFeeBpsLabel(basisPoints),
    source: "platform_settings",
  };
}
