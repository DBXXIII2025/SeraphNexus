"use client";

import Link from "next/link";
import { useState } from "react";

type PricingClientProps = {
  activeBusinessId: string | null;
  isLoggedIn: boolean;
  isPlatformAdmin: boolean;
  currentPlan: string;
  pricing: {
    pro: { label: string; active: boolean };
    elite: { label: string; active: boolean };
  };
};

const PLANS = [
  {
    tier: "trial",
    label: "Trial",
    priceLabel: "$0/mo",
    summary: "Private invite-only access for the restricted launch tier.",
    highlights: [
      "Invite-only free access",
      "One business and capped catalog setup",
      "Upgrade for payments, messaging, and analytics",
    ],
  },
  {
    tier: "pro",
    label: "Pro",
    priceLabel: "$19/mo",
    summary: "Enable payments, full messaging, basic analytics, and standard owner controls.",
    highlights: [
      "5% platform fee",
      "Stripe payments, full messaging, and standard customization",
      "Up to 2 businesses with unlimited services and products",
    ],
  },
  {
    tier: "elite",
    label: "Elite",
    priceLabel: "$49/mo",
    summary: "Best economics and the full premium operating stack for scaling businesses.",
    highlights: [
      "2% platform fee",
      "Automation, advanced analytics, and advanced messaging",
      "Priority explore boost with unlimited businesses",
    ],
  },
] as const;

export default function PricingClient({
  activeBusinessId,
  isLoggedIn,
  isPlatformAdmin,
  currentPlan,
  pricing,
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

          <div className="mt-5 flex flex-wrap gap-3 text-sm text-[var(--text-soft)]">
            <span className="rounded-full border border-[rgba(212,175,55,0.16)] bg-[rgba(212,175,55,0.08)] px-3 py-1">
              Current plan: {currentPlan}
            </span>
            <span className="rounded-full border border-[var(--border-soft)] bg-[rgba(15,12,12,0.52)] px-3 py-1">
              Active business: {activeBusinessId ? "selected" : "not selected"}
            </span>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-[rgba(193,18,31,0.3)] bg-[rgba(193,18,31,0.1)] px-4 py-3 text-sm text-[#f8c6ca]">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrentPlan = currentPlan === plan.tier;
            const isPaidPlan = plan.tier === "pro" || plan.tier === "elite";
            const billingActive =
              plan.tier === "pro"
                ? pricing.pro.active
                : plan.tier === "elite"
                  ? pricing.elite.active
                  : true;
            const disabled =
              !isPaidPlan ||
              isCurrentPlan ||
              isPlatformAdmin ||
              !isLoggedIn ||
              !activeBusinessId ||
              !billingActive;
            const priceLabel =
              plan.tier === "pro"
                ? pricing.pro.label
                : plan.tier === "elite"
                  ? pricing.elite.label
                  : plan.priceLabel;

            return (
              <article
                key={plan.tier}
                className="surface-card flex h-full flex-col border-[rgba(212,175,55,0.16)] p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold text-[var(--text-strong)]">
                      {plan.label}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                      {plan.summary}
                    </p>
                  </div>
                  {isCurrentPlan ? (
                    <span className="rounded-full border border-[rgba(212,175,55,0.18)] bg-[rgba(212,175,55,0.08)] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[var(--accent-gold-soft)]">
                      Current
                    </span>
                  ) : null}
                </div>

                <p className="mt-6 text-3xl font-semibold text-[var(--text-strong)]">
                  {priceLabel}
                </p>
                {!billingActive && isPaidPlan ? (
                  <p className="mt-2 text-sm text-amber-300">
                    Temporarily unavailable for new subscriptions
                  </p>
                ) : null}

                <div className="mt-6 space-y-3">
                  {plan.highlights.map((highlight) => (
                    <div
                      key={highlight}
                      className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(15,12,12,0.42)] px-4 py-3 text-sm text-[var(--text-soft)]"
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
                  ) : isPaidPlan ? (
                    <button
                      type="button"
                      onClick={() => startCheckout(plan.tier)}
                      disabled={disabled}
                      className="btn-primary inline-flex w-full items-center justify-center px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {billingPlan === plan.tier
                        ? "Starting checkout..."
                        : !billingActive
                          ? `${plan.label} unavailable`
                          : `Choose ${plan.label}`}
                    </button>
                  ) : plan.tier === "trial" ? (
                    <span className="btn-secondary inline-flex w-full items-center justify-center px-4 py-2 text-sm font-medium text-[var(--text-soft)]">
                      Trial granted privately
                    </span>
                  ) : (
                    <span className="btn-secondary inline-flex w-full items-center justify-center px-4 py-2 text-sm font-medium text-[var(--text-soft)]">
                      Included by default
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
