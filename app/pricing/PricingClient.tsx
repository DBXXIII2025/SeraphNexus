"use client";

import Link from "next/link";
import { useState } from "react";
import {
  formatPlatformPlanPriceLabel,
  type PlatformPlanCard,
} from "@/lib/platformPlans";

type PricingClientProps = {
  activeBusinessId: string | null;
  isLoggedIn: boolean;
  isPlatformAdmin: boolean;
  currentPlan: string;
  pricingNote: string;
  plans: PlatformPlanCard[];
};

export default function PricingClient({
  activeBusinessId,
  isLoggedIn,
  isPlatformAdmin,
  currentPlan,
  pricingNote,
  plans,
}: PricingClientProps) {
  const [billingPlan, setBillingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(plan: "pro" | "elite") {
    if (!activeBusinessId) {
      setError("Create or select a business before starting billing.");
      return;
    }

    setBillingPlan(plan);
    setError(null);

    try {
      const res = await fetch("/api/stripe/create-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId: activeBusinessId,
          plan,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };

      if (!res.ok || !data.url) {
        setError(data.error || "Subscription checkout could not be started.");
        setBillingPlan(null);
        return;
      }

      window.location.assign(data.url);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Subscription checkout could not be started."
      );
      setBillingPlan(null);
    }
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="premium-card p-6 lg:p-8">
          <p className="section-kicker">Pricing</p>
          <h1 className="mt-3 text-3xl font-semibold text-[var(--text-strong)] sm:text-4xl">
            Pick the fee structure that fits the business you are operating.
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-soft)] sm:text-base">
            Billing now uses the active business context instead of local browser state, which
            prevents upgrades from targeting the wrong workspace.
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-soft)]">
            {pricingNote}
          </p>

          <div className="mt-5 flex flex-wrap gap-3 text-sm text-[var(--text-soft)]">
            <span className="rounded-full border border-[var(--accent-border)] bg-[var(--accent-muted)] px-3 py-1">
              Current plan: {currentPlan}
            </span>
            <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-raised)] px-3 py-1">
              Active business: {activeBusinessId ? "selected" : "not selected"}
            </span>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-[var(--destructive-border)] bg-[var(--destructive-bg)] px-4 py-3 text-sm text-[var(--destructive)]">
            {error}
          </div>
        ) : null}

        <section className={`grid gap-4 ${plans.length >= 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
          {plans.map((plan) => {
            const isCurrentPlan = Boolean(plan.checkout_tier) && currentPlan === plan.checkout_tier;
            const isSelfServePlan = plan.checkout_tier === "pro" || plan.checkout_tier === "elite";
            const disabled =
              !isSelfServePlan ||
              isCurrentPlan ||
              isPlatformAdmin ||
              !isLoggedIn ||
              !activeBusinessId;

            return (
              <article
                key={plan.id}
                className="surface-card flex h-full flex-col border-[var(--accent-border)] p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold text-[var(--text-strong)]">
                      {plan.name}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                      {plan.subtitle}
                    </p>
                  </div>
                  {plan.badge_text ? (
                    <span className="rounded-full border border-[var(--accent-border)] bg-[var(--accent-muted)] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[var(--accent-soft)]">
                      {plan.badge_text}
                    </span>
                  ) : isCurrentPlan ? (
                    <span className="rounded-full border border-[var(--accent-border)] bg-[var(--accent-muted)] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[var(--accent-soft)]">
                      Current
                    </span>
                  ) : null}
                </div>

                <p className="mt-6 text-3xl font-semibold text-[var(--text-strong)]">
                  {formatPlatformPlanPriceLabel(plan.monthly_price_cents)}
                </p>
                <p className="mt-2 text-sm text-[var(--text-soft)]">{plan.billing_note}</p>

                <div className="mt-6 space-y-3">
                  {plan.feature_bullets.map((highlight) => (
                    <div
                      key={highlight}
                      className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-3 text-sm text-[var(--text-soft)]"
                    >
                      {highlight}
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  {!isLoggedIn ? (
                    <Link
                      href={`/login?next=${encodeURIComponent("/pricing")}`}
                      className="btn-primary inline-flex w-full items-center justify-center px-4 py-2 text-sm font-medium"
                    >
                      Login to continue
                    </Link>
                  ) : isPlatformAdmin ? (
                    <span className="btn-secondary inline-flex w-full items-center justify-center px-4 py-2 text-sm font-medium text-[var(--text-soft)]">
                      Platform owner billing disabled
                    </span>
                  ) : !activeBusinessId ? (
                    <Link
                      href="/onboarding/create-business"
                      className="btn-primary inline-flex w-full items-center justify-center px-4 py-2 text-sm font-medium"
                    >
                      Create business first
                    </Link>
                  ) : isSelfServePlan ? (
                    <button
                      type="button"
                      onClick={() => startCheckout(plan.checkout_tier!)}
                      disabled={disabled}
                      className="btn-primary inline-flex w-full items-center justify-center px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {billingPlan === plan.checkout_tier
                        ? "Starting checkout..."
                        : plan.cta_text}
                    </button>
                  ) : (
                    <span className="btn-secondary inline-flex w-full items-center justify-center px-4 py-2 text-sm font-medium text-[var(--text-soft)]">
                      {plan.cta_text}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}
