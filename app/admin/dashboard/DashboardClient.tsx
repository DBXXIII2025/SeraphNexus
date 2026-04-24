"use client";

import Link from "next/link";
import type { DashboardData, DashboardMetricTone } from "@/lib/adminDashboard";
import { formatAdminStatusLabel, getAdminStatusBadgeClass } from "@/lib/adminStatus";
import type { BusinessReadinessState } from "@/lib/businessReadiness";
import type { BusinessOnboardingState } from "@/lib/onboarding";
import type { UpgradeTrigger } from "@/lib/planEnforcement";
import { createAdminTranslator } from "@/lib/adminI18n";
import {
  AdminPageContainer,
  DashboardGrid,
  DashboardPrimaryPanel,
  DashboardSecondaryPanel,
  DashboardSection,
  InfoCard,
  MetricCard as ShellMetricCard,
} from "@/components/admin/AdminLayoutSystem";

type DashboardClientProps = {
  business: {
    id?: string | null;
    name?: string | null;
    language?: "en" | "es" | null;
  } | null;
  dashboard: DashboardData;
  onboarding?: BusinessOnboardingState | null;
  readiness?: BusinessReadinessState | null;
  upgradeTriggers?: UpgradeTrigger[];
};

function getMetricToneClasses(tone: DashboardMetricTone) {
  if (tone === "success") {
    return "text-[var(--accent-soft)]";
  }

  if (tone === "alert") {
    return "text-[var(--accent-soft)]";
  }

  if (tone === "accent") {
    return "text-[var(--text-strong)]";
  }

  return "text-[var(--text-main)]";
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "No timestamp";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function MetricCard({
  label,
  value,
  detail,
  tone,
  statusLabel,
}: {
  label: string;
  value: string;
  detail: string;
  tone: DashboardMetricTone;
  statusLabel?: string;
}) {
  return (
    <ShellMetricCard>
      <p className="text-xs font-medium text-[var(--text-muted)]">{label}</p>
      <div className="mt-3 flex items-start justify-between gap-4">
        <p className={`text-[1.85rem] font-semibold leading-none ${getMetricToneClasses(tone)}`}>{value}</p>
        {statusLabel ? <div className="status-chip">{statusLabel}</div> : null}
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">{detail}</p>
    </ShellMetricCard>
  );
}

export default function DashboardClient({
  business,
  dashboard,
  onboarding,
  readiness,
  upgradeTriggers = [],
}: DashboardClientProps) {
  const t = createAdminTranslator(business?.language);

  return (
    <AdminPageContainer className="text-[var(--text-main)]">
      <DashboardPrimaryPanel>
        <DashboardGrid className="xl:grid-cols-[1.3fr,1fr]">
          <div>
            <p className="section-kicker">{dashboard.businessLabel} {t("dashboard")}</p>
            <h1 className="mt-3 text-3xl font-semibold text-[var(--text-strong)] lg:text-[2.35rem]">
              {business?.name || "Business"} {t("dashboard").toLowerCase()}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-soft)]">
              {dashboard.heroDescription}
            </p>
          </div>

          <InfoCard>
            <p className="section-kicker">{t("operations")}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {dashboard.quickActions.slice(0, 5).map((action, index) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={
                    index === 0
                      ? "btn-primary px-4 py-3 text-sm font-medium"
                      : "btn-secondary px-4 py-3 text-sm font-medium"
                  }
                >
                  {action.label}
                </Link>
              ))}
              <div className="table-row-panel p-4 sm:col-span-2">
                <p className="text-xs font-medium text-[var(--text-muted)]">{t("operationsConsole")}</p>
                <p className="mt-2 text-lg font-semibold text-[var(--accent-soft)]">
                  {dashboard.heroTitle}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                  Modules and activity on this page stay scoped to the active business type.
                </p>
              </div>
            </div>
          </InfoCard>
        </DashboardGrid>
      </DashboardPrimaryPanel>

      {readiness ? (
        <DashboardPrimaryPanel>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="section-kicker">{t("launchControl")}</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
                {readiness.label}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-soft)]">
                {readiness.summary}
              </p>
              {readiness.blockers.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {readiness.blockers.map((blocker) => (
                    <div
                      key={blocker.id}
                      className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-3"
                    >
                      <p className="text-sm font-medium text-[var(--text-strong)]">
                        {blocker.label}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--text-soft)]">
                        {blocker.description}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] p-4 lg:min-w-[240px]">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {t("continueSetup")}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                {readiness.isLive
                  ? "This business is already live."
                  : readiness.nextActionLabel}
              </p>
              {!readiness.isLive ? (
                <Link
                  href={readiness.nextActionHref}
                  className="btn-secondary mt-4 inline-flex w-full justify-center px-4 py-2 text-sm font-medium"
                >
                  {readiness.nextActionLabel}
                </Link>
              ) : null}
            </div>
          </div>

          {readiness.blockers.some((blocker) => blocker.kind === "offerings") ? (
            <div className="mt-5 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-yellow-200">First Data Quickstart</p>
              <h3 className="mt-2 text-lg font-semibold text-[var(--text-main)]">
                {readiness.blockers.find((blocker) => blocker.kind === "offerings")?.label || "Create your first record"}
              </h3>
              <p className="mt-2 text-sm leading-6 text-yellow-100/90">
                Create the first real record for this business type so the workspace becomes operational and launch readiness can move forward.
              </p>
              <Link
                href={readiness.blockers.find((blocker) => blocker.kind === "offerings")?.href || readiness.nextActionHref}
                className="btn-secondary mt-4 inline-flex px-4 py-2 text-sm font-medium"
              >
                Open first-data setup
              </Link>
            </div>
          ) : null}
        </DashboardPrimaryPanel>
      ) : null}

      {onboarding && !onboarding.isComplete ? (
        <DashboardSecondaryPanel>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="section-kicker">{t("continueSetup")}</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
                Finish onboarding for {business?.name || onboarding.businessName}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-soft)]">
                {onboarding.completedCount} of {onboarding.totalCount} setup steps are complete.
                Next up: {onboarding.currentStep?.label || "Continue setup"}.
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] p-4 lg:min-w-[240px]">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Setup Progress
              </p>
              <p className="mt-2 text-3xl font-semibold text-[var(--accent-soft)]">
                {onboarding.progressPercent}%
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--accent-muted)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)]"
                  style={{ width: `${onboarding.progressPercent}%` }}
                />
              </div>
              <Link
                href={onboarding.resumeHref}
                className="btn-secondary mt-4 inline-flex w-full justify-center px-4 py-2 text-sm font-medium"
              >
                Open onboarding
              </Link>
            </div>
          </div>
        </DashboardSecondaryPanel>
      ) : null}

      {upgradeTriggers.length > 0 ? (
        <DashboardPrimaryPanel>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-kicker">Upgrade Signals</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
                Limits and locked features
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-soft)]">
                These prompts appear when growth or locked features indicate the current plan is
                constraining the workspace.
              </p>
            </div>
            <Link href="/admin/upgrade" className="btn-secondary px-4 py-2 text-sm font-medium">
              Review plans
            </Link>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {upgradeTriggers.map((trigger) => (
              <Link
                key={trigger.id}
                href={trigger.href}
                className="table-row-panel block p-4 transition hover:border-[var(--accent-border)]"
              >
                <p className="text-sm font-medium text-[var(--text-strong)]">{trigger.title}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">{trigger.detail}</p>
                <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-[var(--accent-soft)]">
                  Upgrade options
                </p>
              </Link>
            ))}
          </div>
        </DashboardPrimaryPanel>
      ) : null}

      <DashboardSection>
        <DashboardGrid className="dashboard-metrics-grid sm:grid-cols-2">
          {dashboard.metrics.map((metric) => (
            <MetricCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              detail={metric.detail}
              tone={metric.tone}
              statusLabel={readiness?.label}
            />
          ))}
        </DashboardGrid>
      </DashboardSection>

      <DashboardGrid className="dashboard-grid-shell">
        <DashboardPrimaryPanel>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-kicker">{dashboard.activityTitle}</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
                Operational feed
              </h2>
            </div>
            <span className="status-chip">{dashboard.recentActivity.length} items</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">
            {dashboard.activityDescription}
          </p>

          <div className="mt-5 space-y-3">
            {dashboard.recentActivity.length === 0 ? (
              <div className="empty-state">
                No recent activity is available for this business yet.
              </div>
            ) : (
              dashboard.recentActivity.map((item) => (
                <div key={item.id} className="table-row-panel p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-[var(--text-strong)]">{item.title}</p>
                      <p className="mt-1 text-sm text-[var(--text-soft)]">{item.detail}</p>
                      <p className="mt-2 text-xs text-[var(--text-muted)]">
                        {formatDateTime(item.timestamp)}
                      </p>
                      {item.href ? (
                        <Link
                          href={item.href}
                          className="mt-3 inline-flex text-sm font-medium text-[var(--accent-soft)]"
                        >
                          View details
                        </Link>
                      ) : null}
                    </div>

                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium capitalize ${getAdminStatusBadgeClass(
                        item.status
                      )}`}
                    >
                      {formatAdminStatusLabel(item.status || item.kind, item.kind)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </DashboardPrimaryPanel>

        <div className="space-y-6">
          {dashboard.emptyState ? (
            <DashboardSecondaryPanel>
              <p className="section-kicker">Empty State</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
                {dashboard.emptyState.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">
                {dashboard.emptyState.description}
              </p>
              <div className="mt-5 grid gap-3">
                {dashboard.emptyState.actions.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="btn-secondary px-4 py-3 text-sm font-medium"
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            </DashboardSecondaryPanel>
          ) : null}

          <DashboardSecondaryPanel>
            <p className="section-kicker">Scope</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
              Active business context
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">
              This dashboard is resolved from the active business record and only shows modules that
              match the current `business_type`.
            </p>
            <div className="mt-5 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Business Type
              </p>
              <p className="mt-2 text-lg font-semibold text-[var(--text-strong)]">
                {dashboard.businessType}
              </p>
            </div>
          </DashboardSecondaryPanel>

          {dashboard.notes.length > 0 ? (
            <DashboardSecondaryPanel>
              <p className="section-kicker">Notes</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
                Data caveats
              </h2>
              <div className="mt-5 space-y-3 text-sm leading-6 text-[var(--text-soft)]">
                {dashboard.notes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            </DashboardSecondaryPanel>
          ) : null}
        </div>
      </DashboardGrid>
    </AdminPageContainer>
  );
}


