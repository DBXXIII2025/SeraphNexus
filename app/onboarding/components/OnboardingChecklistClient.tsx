"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BusinessOnboardingState } from "@/lib/onboarding";

export default function OnboardingChecklistClient({
  onboarding,
}: {
  onboarding: BusinessOnboardingState;
}) {
  const router = useRouter();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function goToStep(href: string) {
    try {
      setError(null);
      setNavigatingTo(href);

      const res = await fetch("/api/set-active-business", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ businessId: onboarding.businessId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to restore business context");
      }

      router.push(href);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to continue setup");
      setNavigatingTo(null);
    }
  }

  return (
    <div className="space-y-6 text-[var(--text-main)]">
      <section className="premium-card p-6 lg:p-7">
        <div className="grid gap-6 xl:grid-cols-[1.45fr,0.9fr]">
          <div>
            <p className="section-kicker">Guided Onboarding</p>
            <h1 className="mt-3 text-3xl font-semibold text-[var(--text-strong)] lg:text-[2.2rem]">
              {onboarding.businessName} setup
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-soft)]">
              Follow the relevant setup steps for your {onboarding.businessLabel.toLowerCase()} business.
              Progress is inferred from your real business data, so you can leave and return later
              without losing your place.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--accent-border)] bg-[var(--surface-raised)] p-5">
            <p className="section-kicker">Progress</p>
            <div className="mt-4 flex items-end justify-between gap-3">
              <p className="text-4xl font-semibold text-[var(--accent-soft)]">
                {onboarding.progressPercent}%
              </p>
              <span className="status-chip">
                {onboarding.completedCount}/{onboarding.totalCount} complete
              </span>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-[var(--accent-muted)]">
              <div
                className="h-full rounded-full bg-[var(--accent)]"
                style={{ width: `${onboarding.progressPercent}%` }}
              />
            </div>
            <p className="mt-4 text-sm text-[var(--text-soft)]">
              {onboarding.isComplete
                ? `Setup is complete. You can move into your ${onboarding.workspaceLabel.toLowerCase()} workspace.`
                : `Current step: ${onboarding.currentStep?.label || "Continue setup"}`}
            </p>
            <button
              type="button"
              onClick={() =>
                goToStep(
                  onboarding.isComplete
                    ? onboarding.workspaceHref
                    : onboarding.currentStep?.href || onboarding.workspaceHref
                )
              }
              disabled={Boolean(navigatingTo)}
              className="btn-primary mt-5 w-full px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            >
              {navigatingTo
                ? "Opening..."
                : onboarding.isComplete
                  ? `Open ${onboarding.workspaceLabel}`
                  : `Continue: ${onboarding.currentStep?.label || "Setup"}`}
            </button>
            {!onboarding.isComplete ? (
              <button
                type="button"
                onClick={() => goToStep(onboarding.workspaceHref)}
                disabled={Boolean(navigatingTo)}
                className="btn-secondary mt-3 w-full px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
              >
                Go to {onboarding.workspaceLabel}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <section className="surface-card p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="section-kicker">Checklist</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
              Setup steps
            </h2>
          </div>
          <span className="status-chip">{onboarding.businessType}</span>
        </div>

        <div className="mt-5 space-y-3">
          {onboarding.steps.map((step, index) => {
            const isCurrent = !step.completed && onboarding.currentStep?.id === step.id;

            return (
              <div key={step.id} className="table-row-panel p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                      Step {index + 1}
                    </p>
                    <p className="mt-2 font-medium text-[var(--text-strong)]">{step.label}</p>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-soft)]">
                      {step.description}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${
                        step.completed
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : isCurrent
                            ? "border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--accent-soft)]"
                            : "border-[var(--border-soft)] bg-[var(--surface-raised)] text-[var(--text-soft)]"
                      }`}
                    >
                      {step.completed ? "Completed" : isCurrent ? "Current" : "Incomplete"}
                    </span>
                    <button
                      type="button"
                      onClick={() => goToStep(step.href)}
                      disabled={Boolean(navigatingTo)}
                      className="btn-secondary px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {step.completed ? "Review step" : "Open step"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {onboarding.notes.length > 0 ? (
        <section className="surface-card p-6">
          <p className="section-kicker">Notes</p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
            Setup caveats
          </h2>
          <div className="mt-5 space-y-3 text-sm leading-6 text-[var(--text-soft)]">
            {onboarding.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
