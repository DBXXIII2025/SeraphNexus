"use client";

import { useState } from "react";
import {
  PLAN_DEFINITIONS,
  type PlanFeature,
  type PlanTier,
} from "@/lib/planConfig";

const FEATURE_LABELS: Record<PlanFeature, string> = {
  stripe_payments: "Stripe payments",
  full_messaging: "Full messaging",
  basic_analytics: "Basic analytics",
  standard_customization: "Standard customization",
  advanced_analytics: "Advanced analytics",
  automation: "Automation and reminders",
  priority_listing: "Priority explore boost",
  team_roles: "Team and staff roles",
  advanced_customization: "Advanced customization",
  advanced_messaging: "Advanced messaging tools",
  advanced_payments: "Advanced payment features",
  lead_capture: "Lead capture",
  branding_customization: "Brand customization",
};

export default function UpgradeClient({
  businessId,
  currentPlan,
  pricing,
  planCopy,
}: {
  businessId: string;
  currentPlan: PlanTier;
  pricing: {
    trial: { feeLabel: string };
    pro: { label: string; active: boolean; feeLabel: string };
    elite: { label: string; active: boolean; feeLabel: string };
  };
  planCopy: {
    pro: {
      name: string;
      subtitle: string;
      features: string[];
      badge: string | null;
      cta: string;
    };
    elite: {
      name: string;
      subtitle: string;
      features: string[];
      badge: string | null;
      cta: string;
    };
  };
}) {
  const [loadingPlan, setLoadingPlan] = useState<PlanTier | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choosePlan(plan: PlanTier) {
    setError(null);
    setLoadingPlan(plan);

    try {
      if (plan !== "pro" && plan !== "elite") {
        throw new Error("Trial and inactive access are managed by the platform admin.");
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
        {(["trial", "pro", "elite"] as PlanTier[]).map((tier) => {
          const plan = PLAN_DEFINITIONS[tier];
          const liveCopy =
            tier === "pro"
              ? planCopy.pro
              : tier === "elite"
                ? planCopy.elite
                : null;
          const isCurrent = tier === currentPlan;
          const priceLabel =
            tier === "pro"
              ? pricing.pro.label
              : tier === "elite"
                ? pricing.elite.label
                : plan.monthlyPriceLabel;
          const billingActive =
            tier === "pro"
              ? pricing.pro.active
              : tier === "elite"
                ? pricing.elite.active
                : true;
          const feeLabel =
            tier === "pro"
              ? pricing.pro.feeLabel
              : tier === "elite"
                ? pricing.elite.feeLabel
                : pricing.trial.feeLabel;
          const planLabel = liveCopy?.name || plan.label;
          const planDescription = liveCopy?.subtitle || plan.description;
          const highlights = liveCopy?.features?.length ? liveCopy.features : plan.highlights;
          const ctaText =
            tier === "pro" || tier === "elite"
              ? liveCopy?.cta || `Upgrade to ${planLabel}`
              : "Trial managed by platform admin";

          return (
            <div
              key={tier}
              className={`rounded-2xl border p-6 ${
                isCurrent
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : "border-[var(--border-soft)] bg-[var(--surface)]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{planLabel}</h2>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">{planDescription}</p>
                </div>
                {liveCopy?.badge ? (
                  <span className="rounded-full border border-[var(--accent-border)] bg-[var(--accent-muted)] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
                    {liveCopy.badge}
                  </span>
                ) : isCurrent ? (
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-200">
                    Current
                  </span>
                ) : null}
              </div>

              <div className="mt-5">
                <p className="text-3xl font-semibold">{priceLabel}</p>
                <p className="mt-1 text-sm text-[var(--text-soft)]">
                  Platform fee: {feeLabel}
                </p>
                {!billingActive && tier !== "trial" ? (
                  <p className="mt-2 text-xs text-[var(--warning)]">
                    Temporarily unavailable for new subscriptions
                  </p>
                ) : null}
              </div>

              <ul className="mt-5 space-y-2 text-sm text-[var(--text-soft)]">
                {highlights.map((highlight) => (
                  <li key={highlight} className="rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                    {highlight}
                  </li>
                ))}
              </ul>

              <div className="mt-5 space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Feature Access
                </p>
                <div className="space-y-2">
                  {(Object.keys(FEATURE_LABELS) as PlanFeature[]).map((feature) => {
                    const enabled = plan.features.includes(feature);

                    return (
                      <div
                        key={feature}
                        className="flex items-center justify-between rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm"
                      >
                        <span>{FEATURE_LABELS[feature]}</span>
                        <span
                          className={enabled ? "text-emerald-300" : "text-[var(--text-muted)]"}
                        >
                          {enabled ? "Included" : "Locked"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() => choosePlan(tier)}
                disabled={isCurrent || loadingPlan !== null || (!billingActive && tier !== "trial")}
                className="mt-6 w-full rounded-lg bg-[var(--surface-raised)] px-4 py-2 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--accent-muted)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCurrent
                  ? "Current Plan"
                  : loadingPlan === tier
                    ? "Starting checkout..."
                    : !billingActive && tier !== "trial"
                      ? `${planLabel} temporarily unavailable`
                      : ctaText}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
