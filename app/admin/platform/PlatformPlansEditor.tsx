"use client";

import { useMemo, useState } from "react";
import {
  formatPlatformPlanPriceLabel,
  type PlatformPlanCard,
} from "@/lib/platformPlans";

function slugifyPlanId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createCustomPlan(index: number): PlatformPlanCard {
  return {
    id: `custom-plan-${index}`,
    name: "Custom Plan",
    subtitle: "Custom pricing and positioning for a future offer.",
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
}

export default function PlatformPlansEditor({
  initialPlans,
}: {
  initialPlans: PlatformPlanCard[];
}) {
  const [plans, setPlans] = useState<PlatformPlanCard[]>(initialPlans);

  const serializedPlans = useMemo(() => JSON.stringify(plans), [plans]);

  function updatePlan(index: number, updater: (plan: PlatformPlanCard) => PlatformPlanCard) {
    setPlans((current) => current.map((plan, planIndex) => (planIndex === index ? updater(plan) : plan)));
  }

  function removePlan(index: number) {
    setPlans((current) => current.filter((_, planIndex) => planIndex !== index));
  }

  return (
    <div className="form-section space-y-4">
      <input type="hidden" name="managed_plan_cards_json" value={serializedPlans} />
      <div className="section-header-copy">
        <p className="section-kicker">Plan Cards</p>
        <h3 className="text-lg font-semibold text-[var(--text-strong)]">
          Visible pricing and upgrade plans
        </h3>
        <p className="section-description">
          Pro and Elite stay billing-linked. Custom plans are display-managed here without changing Stripe subscription safety.
        </p>
      </div>

      <div className="space-y-4">
        {plans.map((plan, index) => {
          const isCorePlan = plan.id === "pro" || plan.id === "elite" || plan.is_default;

          return (
            <section key={`${plan.id}-${index}`} className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="section-kicker">{isCorePlan ? "Billing-linked plan" : "Custom plan"}</p>
                  <h4 className="mt-1 text-lg font-semibold text-[var(--text-strong)]">
                    {plan.name}
                  </h4>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">
                    Display price: {formatPlatformPlanPriceLabel(plan.monthly_price_cents)}
                  </p>
                </div>
                {isCorePlan ? (
                  <span className="status-chip">{plan.id.toUpperCase()}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => removePlan(index)}
                    className="btn-secondary px-3 py-2 text-xs font-medium"
                  >
                    Remove plan
                  </button>
                )}
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-sm text-[var(--text-soft)]">
                  <span className="form-label">Plan id</span>
                  <input
                    value={plan.id}
                    disabled={isCorePlan}
                    onChange={(event) =>
                      updatePlan(index, (current) => ({
                        ...current,
                        id: slugifyPlanId(event.target.value) || current.id,
                      }))
                    }
                    className="input-field mt-2 disabled:opacity-60"
                  />
                </label>
                <label className="flex items-center gap-3 self-end text-sm text-[var(--text-soft)]">
                  <input
                    type="checkbox"
                    checked={plan.is_active}
                    onChange={(event) =>
                      updatePlan(index, (current) => ({
                        ...current,
                        is_active: event.target.checked,
                      }))
                    }
                  />
                  <span>Plan active and visible</span>
                </label>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-sm text-[var(--text-soft)]">
                  <span className="form-label">Plan name</span>
                  <input
                    value={plan.name}
                    onChange={(event) =>
                      updatePlan(index, (current) => ({ ...current, name: event.target.value }))
                    }
                    className="input-field mt-2"
                  />
                </label>
                <label className="text-sm text-[var(--text-soft)]">
                  <span className="form-label">CTA text</span>
                  <input
                    value={plan.cta_text}
                    onChange={(event) =>
                      updatePlan(index, (current) => ({ ...current, cta_text: event.target.value }))
                    }
                    className="input-field mt-2"
                  />
                </label>
              </div>

              <label className="mt-4 block text-sm text-[var(--text-soft)]">
                <span className="form-label">Subtitle / tagline</span>
                <textarea
                  value={plan.subtitle}
                  onChange={(event) =>
                    updatePlan(index, (current) => ({ ...current, subtitle: event.target.value }))
                  }
                  className="input-field mt-2 min-h-[88px]"
                />
              </label>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <label className="text-sm text-[var(--text-soft)]">
                  <span className="form-label">Monthly price</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={(plan.monthly_price_cents / 100).toFixed(2)}
                    onChange={(event) =>
                      updatePlan(index, (current) => ({
                        ...current,
                        monthly_price_cents: Math.max(
                          0,
                          Math.round((Number(event.target.value || 0) || 0) * 100)
                        ),
                      }))
                    }
                    className="input-field mt-2"
                  />
                </label>
                <label className="text-sm text-[var(--text-soft)]">
                  <span className="form-label">Transaction fee %</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={(plan.transaction_fee_bps / 100).toFixed(2)}
                    onChange={(event) =>
                      updatePlan(index, (current) => ({
                        ...current,
                        transaction_fee_bps: Math.max(
                          0,
                          Math.min(10000, Math.round((Number(event.target.value || 0) || 0) * 100))
                        ),
                      }))
                    }
                    className="input-field mt-2"
                  />
                </label>
                <label className="text-sm text-[var(--text-soft)]">
                  <span className="form-label">Badge text</span>
                  <input
                    value={plan.badge_text || ""}
                    onChange={(event) =>
                      updatePlan(index, (current) => ({
                        ...current,
                        badge_text: event.target.value.trim() || null,
                      }))
                    }
                    className="input-field mt-2"
                  />
                </label>
              </div>

              <label className="mt-4 block text-sm text-[var(--text-soft)]">
                <span className="form-label">Billing note</span>
                <input
                  value={plan.billing_note}
                  onChange={(event) =>
                    updatePlan(index, (current) => ({ ...current, billing_note: event.target.value }))
                  }
                  className="input-field mt-2"
                />
              </label>

              <label className="mt-4 block text-sm text-[var(--text-soft)]">
                <span className="form-label">Feature bullets, one per line</span>
                <textarea
                  value={plan.feature_bullets.join("\n")}
                  onChange={(event) =>
                    updatePlan(index, (current) => ({
                      ...current,
                      feature_bullets: event.target.value
                        .split(/\r?\n/)
                        .map((item) => item.trim())
                        .filter(Boolean)
                        .slice(0, 10),
                    }))
                  }
                  className="input-field mt-2 min-h-[132px]"
                />
              </label>

              {isCorePlan ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="text-sm text-[var(--text-soft)]">
                    <span className="form-label">Stripe price ID</span>
                    <input
                      value={plan.stripe_price_id || ""}
                      onChange={(event) =>
                        updatePlan(index, (current) => ({
                          ...current,
                          stripe_price_id: event.target.value.trim() || null,
                        }))
                      }
                      className="input-field mt-2"
                    />
                  </label>
                  <label className="text-sm text-[var(--text-soft)]">
                    <span className="form-label">Stripe product ID</span>
                    <input
                      value={plan.stripe_product_id || ""}
                      onChange={(event) =>
                        updatePlan(index, (current) => ({
                          ...current,
                          stripe_product_id: event.target.value.trim() || null,
                        }))
                      }
                      className="input-field mt-2"
                    />
                  </label>
                </div>
              ) : (
                <p className="mt-4 text-xs text-[var(--text-muted)]">
                  Custom plans are display-managed. Stripe billing fields remain tied to the default Pro and Elite plans.
                </p>
              )}
            </section>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setPlans((current) => [...current, createCustomPlan(current.length + 1)])}
        className="btn-secondary px-4 py-2 text-sm font-medium"
      >
        Add custom plan
      </button>
    </div>
  );
}
