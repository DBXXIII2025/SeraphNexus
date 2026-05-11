"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PlanGrantListItem } from "@/lib/planGrantAdmin";
import {
  DashboardGrid,
  DashboardPrimaryPanel,
  DashboardSecondaryPanel,
} from "@/components/admin/AdminLayoutSystem";

type ManualPlanGrantPanelProps = {
  activePlanGrants: PlanGrantListItem[];
  planGrantHistory: PlanGrantListItem[];
};

type GrantResponse = {
  ok: boolean;
  message?: string;
  activePlanGrants?: PlanGrantListItem[];
  planGrantHistory?: PlanGrantListItem[];
};

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "No signal";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

export default function ManualPlanGrantPanel({
  activePlanGrants: initialActivePlanGrants,
  planGrantHistory: initialPlanGrantHistory,
}: ManualPlanGrantPanelProps) {
  const router = useRouter();
  const [activePlanGrants, setActivePlanGrants] = useState(initialActivePlanGrants);
  const [planGrantHistory, setPlanGrantHistory] = useState(initialPlanGrantHistory);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function submitGrantForm(formData: FormData) {
    const response = await fetch("/api/admin/platform/plan-grants", {
      method: "POST",
      body: formData,
      headers: {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    const payload = (await response.json().catch(() => null)) as GrantResponse | null;

    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.message || "Manual plan grant could not be completed.");
    }

    setActivePlanGrants(payload.activePlanGrants || []);
    setPlanGrantHistory(payload.planGrantHistory || []);
    setSubmitMessage(payload.message || "Manual plan grant updated.");
    setSubmitError(null);
    startTransition(() => {
      router.refresh();
    });
  }

  async function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitMessage(null);
    setSubmitError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      setIsSubmitting(true);
      await submitGrantForm(formData);
      form.reset();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Manual plan grant could not be created."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRevoke(grantId: string) {
    setSubmitMessage(null);
    setSubmitError(null);

    const formData = new FormData();
    formData.set("action", "revoke_plan_grant");
    formData.set("grant_id", grantId);

    try {
      setIsSubmitting(true);
      await submitGrantForm(formData);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Manual plan grant revocation failed."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {submitMessage ? (
        <DashboardSecondaryPanel className="border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {submitMessage}
        </DashboardSecondaryPanel>
      ) : null}

      {submitError ? (
        <DashboardSecondaryPanel className="border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {submitError}
        </DashboardSecondaryPanel>
      ) : null}

      <DashboardGrid className="xl:grid-cols-[0.95fr,1.05fr]">
        <DashboardPrimaryPanel className="p-6">
          <p className="section-kicker">Manual Plan Grants</p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
            Grant temporary or permanent Pro and Elite access
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">
            Manual plan grants override billing-derived plan access without mutating Stripe
            subscription records. Temporary grants fall back automatically when they expire.
          </p>

          <div className="mt-5 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] p-4 text-sm text-[var(--text-soft)]">
            <p>Preset actions supported in this form:</p>
            <p className="mt-2">Pro permanent, Pro temporary, Elite permanent, Elite temporary.</p>
          </div>

          <form onSubmit={handleCreateSubmit} className="mt-5 space-y-4">
            <input type="hidden" name="action" value="create_plan_grant" />
            <label className="text-sm text-[var(--text-soft)]">
              <span className="form-label">Existing user email</span>
              <input name="email" type="email" required className="input-field" />
            </label>
            <label className="text-sm text-[var(--text-soft)]">
              <span className="form-label">Business ID</span>
              <input
                name="business_id"
                className="input-field"
                placeholder="Optional business scope"
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm text-[var(--text-soft)]">
                <span className="form-label">Plan</span>
                <select name="granted_plan" className="input-field" defaultValue="elite">
                  <option value="elite">Elite</option>
                  <option value="pro">Pro</option>
                </select>
              </label>
              <label className="text-sm text-[var(--text-soft)]">
                <span className="form-label">Grant type</span>
                <select name="grant_type" className="input-field" defaultValue="temporary">
                  <option value="temporary">Temporary</option>
                  <option value="permanent">Permanent</option>
                </select>
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm text-[var(--text-soft)]">
                <span className="form-label">Duration preset</span>
                <select name="duration_preset" className="input-field" defaultValue="14d">
                  <option value="7d">7 days</option>
                  <option value="14d">14 days</option>
                  <option value="30d">30 days</option>
                  <option value="custom">Custom expiration date</option>
                </select>
              </label>
              <label className="text-sm text-[var(--text-soft)]">
                <span className="form-label">Custom expiration</span>
                <input
                  name="custom_expires_at"
                  type="datetime-local"
                  className="input-field"
                />
              </label>
            </div>
            <label className="text-sm text-[var(--text-soft)]">
              <span className="form-label">Reason</span>
              <textarea
                name="reason"
                className="input-field min-h-[110px]"
                placeholder="Why is this manual plan override being granted?"
              />
            </label>
            <button
              type="submit"
              disabled={isSubmitting || isPending}
              className="btn-primary px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting || isPending ? "Saving grant..." : "Create manual plan grant"}
            </button>
          </form>
        </DashboardPrimaryPanel>

        <DashboardSecondaryPanel className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-kicker">Active Manual Grants</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
                Current plan overrides
              </h2>
            </div>
            <span className="text-sm text-[var(--text-soft)]">
              {activePlanGrants.length} active
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {activePlanGrants.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-8 text-sm text-[var(--text-soft)]">
                No active manual plan grants.
              </div>
            ) : (
              activePlanGrants.map((grant) => (
                <div key={grant.id} className="table-row-panel p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-[var(--text-strong)]">
                        {grant.email || grant.userId} | {grant.grantedPlan} | {grant.grantType}
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-soft)]">{grant.scopeLabel}</p>
                      <p className="mt-2 text-xs text-[var(--text-muted)]">
                        Granted by {grant.grantedBy || "unknown"} | Starts {formatDateTime(grant.startsAt)}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        Effective now: {grant.effectivePlan} | Stored plan: {grant.storedPlan} |{" "}
                        {grant.appliesNow ? "grant currently in force" : "another plan currently wins"}
                      </p>
                      {grant.expiresAt ? (
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          Expires {formatDateTime(grant.expiresAt)}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-[var(--text-muted)]">Permanent grant</p>
                      )}
                      {grant.reason ? (
                        <p className="mt-2 text-xs text-[var(--text-muted)]">
                          Reason: {grant.reason}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      disabled={isSubmitting || isPending}
                      onClick={() => {
                        void handleRevoke(grant.id);
                      }}
                      className="btn-secondary px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DashboardSecondaryPanel>
      </DashboardGrid>

      <section className="dashboard-primary-panel p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="section-kicker">Grant History</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
              Manual grant audit trail
            </h2>
          </div>
          <span className="text-sm text-[var(--text-soft)]">{planGrantHistory.length} total</span>
        </div>

        <div className="mt-5 space-y-3">
          {planGrantHistory.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-8 text-sm text-[var(--text-soft)]">
              No manual grant history yet.
            </div>
          ) : (
            planGrantHistory.slice(0, 24).map((grant) => (
              <div key={grant.id} className="table-row-panel p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-[var(--text-strong)]">
                      {grant.email || grant.userId} | {grant.grantedPlan} | {grant.status}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-soft)]">{grant.scopeLabel}</p>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      {grant.grantType} grant | Created {formatDateTime(grant.createdAt)} | Updated{" "}
                      {formatDateTime(grant.updatedAt)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Granted by {grant.grantedBy || "unknown"} | Starts{" "}
                      {formatDateTime(grant.startsAt)}
                      {grant.expiresAt
                        ? ` | Expires ${formatDateTime(grant.expiresAt)}`
                        : " | No expiry"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Effective now: {grant.effectivePlan} | Stored plan: {grant.storedPlan}
                    </p>
                    {grant.reason ? (
                      <p className="mt-2 text-xs text-[var(--text-muted)]">Reason: {grant.reason}</p>
                    ) : null}
                  </div>
                  <span className="status-chip">{grant.status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}
