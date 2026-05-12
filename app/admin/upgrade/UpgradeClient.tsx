"use client";

import { useState } from "react";
import type { PlanTier } from "@/lib/planConfig";
import {
  formatPlatformPlanPriceLabel,
  type PlatformPlanCard,
} from "@/lib/platformPlans";

export default function UpgradeClient({
  businessId,
  currentPlan,
  pricingNote,
  plans,
}: {
  businessId: string;
  currentPlan: PlanTier;
  pricingNote: string;
  plans: PlatformPlanCard[];
}) {
  const [loadingPlan, setLoadingPlan] = useState<PlanTier | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choosePlan(plan: PlanTier) {
    setError(null);
    setLoadingPlan(plan);

    try {
      if (plan !== "pro" && plan !== "elite") {
        throw new Error("This plan is not configured for self-serve billing.");
      }

      const res = await fetch("/api/stripe/create-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ businessId, plan }),
      });

      const data = await res.json();
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Failed to start upgrade");
      }

      window.location.href = data.url;
    } catch (err: any) {
      setError(err?.message || "Failed to start upgrade");
      setLoadingPlan(null);
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => {
          const tier = plan.checkout_tier;
          const isCurrent = Boolean(tier) && tier === currentPlan;

          return (
            <div
              key={plan.id}
              className={`rounded-2xl border p-6 ${
                isCurrent
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : "border-[var(--border-soft)] bg-[var(--surface)]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{plan.name}</h2>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">{plan.subtitle}</p>
                </div>
                {plan.badge_text ? (
                  <span className="rounded-full border border-[var(--accent-border)] bg-[var(--accent-muted)] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
                    {plan.badge_text}
                  </span>
                ) : isCurrent ? (
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-200">
                    Current
                  </span>
                ) : null}
              </div>

              <div className="mt-5">
                <p className="text-3xl font-semibold">
                  {formatPlatformPlanPriceLabel(plan.monthly_price_cents)}
                </p>
                <p className="mt-1 text-sm text-[var(--text-soft)]">
                  Platform fee: {(plan.transaction_fee_bps / 100).toFixed(2)}%
                </p>
                <p className="mt-2 text-xs text-[var(--text-muted)]">{plan.billing_note}</p>
              </div>

              <ul className="mt-5 space-y-2 text-sm text-[var(--text-soft)]">
                {plan.feature_bullets.map((highlight) => (
                  <li key={highlight} className="rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                    {highlight}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => (tier ? choosePlan(tier) : undefined)}
                disabled={isCurrent || loadingPlan !== null || !tier}
                className="mt-6 w-full rounded-lg bg-[var(--surface-raised)] px-4 py-2 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--accent-muted)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCurrent
                  ? "Current Plan"
                  : loadingPlan === tier
                    ? "Starting checkout..."
                    : plan.cta_text}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-sm text-[var(--text-soft)]">{pricingNote}</p>
      <p className="text-xs text-[var(--text-muted)]">
        Starter Access remains the default workspace tier and is managed outside subscription checkout.
      </p>
    </div>
  );
}
