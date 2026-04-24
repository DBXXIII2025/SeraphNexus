import Link from "next/link";
import { getPlatformAdminData } from "@/lib/platformAdminData";
import {
  getPlatformIncomeAudit,
  getPlatformOwnerBusinessAudits,
} from "@/lib/platformOwnerCleanup";
import {
  AdminPageContainer,
  DashboardGrid,
  DashboardPrimaryPanel,
  DashboardSecondaryPanel,
  MetricCard,
} from "@/components/admin/AdminLayoutSystem";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "No timestamp";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

export default async function PlatformOwnerDashboard({
  ownerUserId,
}: {
  ownerUserId: string;
}) {
  const [platformData, cleanupAudits] = await Promise.all([
    getPlatformAdminData(),
    getPlatformOwnerBusinessAudits(ownerUserId),
  ]);
  const incomeAudit = getPlatformIncomeAudit();
  const testBusinessCandidates = cleanupAudits.filter(
    (business) => business.isLikelyTestBusiness
  );

  return (
    <AdminPageContainer className="text-[var(--text-main)]">
      <DashboardGrid className="md:grid-cols-2 xl:grid-cols-3">
        {platformData.metrics.map((metric) => (
          <MetricCard key={metric.label}>
            <p className="section-kicker">{metric.label}</p>
            <p
              className={`mt-5 text-4xl font-semibold ${
                metric.tone === "success"
                  ? "text-[var(--accent-soft)]"
                  : metric.tone === "alert"
                    ? "text-[var(--accent-soft)]"
                    : "text-[var(--text-strong)]"
              }`}
            >
              {metric.value}
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">
              {metric.detail}
            </p>
          </MetricCard>
        ))}
      </DashboardGrid>

      <DashboardGrid className="dashboard-grid-shell">
        <DashboardPrimaryPanel>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-kicker">Platform Health</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
                Businesses needing attention
              </h2>
            </div>
            <Link
              href="/admin/platform"
              className="btn-secondary px-4 py-2 text-sm font-medium"
            >
              Open platform control
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {platformData.businessesNeedingAttention.slice(0, 6).map((business) => (
              <div key={business.id} className="table-row-panel p-4">
                <p className="font-medium text-[var(--text-strong)]">{business.name}</p>
                <p className="mt-1 text-sm text-[var(--text-soft)]">
                  {business.businessType || "business"} | effective {business.effectivePlan} plan
                </p>
                {business.effectivePlan !== business.storedPlan ? (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Stored billing plan: {business.storedPlan}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  {!business.legalAccepted ? "Legal acceptance missing" : null}
                  {!business.legalAccepted &&
                  (!business.stripeReady || !business.isPublished)
                    ? " | "
                    : ""}
                  {!business.stripeReady ? "Stripe not ready" : null}
                  {!business.stripeReady && !business.isPublished ? " | " : ""}
                  {!business.isPublished ? "Not published" : null}
                </p>
              </div>
            ))}
            {platformData.businessesNeedingAttention.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-8 text-sm text-[var(--text-soft)]">
                No businesses are currently flagged by onboarding, legal, or payout
                readiness checks.
              </div>
            ) : null}
          </div>
        </DashboardPrimaryPanel>

        <div className="space-y-6">
          <DashboardSecondaryPanel>
            <p className="section-kicker">Support Queue</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
              Business owner support
            </h2>
            <div className="mt-5 space-y-3">
              {platformData.supportThreads.slice(0, 5).map((thread) => (
                <div
                  key={thread.id}
                  className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] p-4"
                >
                  <p className="font-medium text-[var(--text-strong)]">
                    {thread.businessName || "Business"}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">
                    {thread.ownerEmail || "Owner"} | {thread.unreadForPlatform} unread
                  </p>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    {thread.lastMessageExcerpt || "No messages yet"} |{" "}
                    {formatDateTime(thread.lastMessageAt)}
                  </p>
                </div>
              ))}
              {platformData.supportThreads.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-8 text-sm text-[var(--text-soft)]">
                  No platform support threads yet.
                </div>
            ) : null}
          </div>
          </DashboardSecondaryPanel>

          <DashboardSecondaryPanel>
            <p className="section-kicker">Income Audit</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
              Revenue posture
            </h2>
            <div className="mt-4 space-y-3 text-sm text-[var(--text-soft)]">
              <p>Projected MRR from current plans: {formatCurrency(platformData.totalMRR)}</p>
              <p>
                Known stored platform fee revenue:{" "}
                {formatCurrency(platformData.transactionPlatformRevenue)}
              </p>
              <p>
                Subscription ledger in DB:{" "}
                {incomeAudit.hasSubscriptionLedger ? "Yes" : "No"}
              </p>
              <p>
                Stored order platform fees:{" "}
                {incomeAudit.hasStoredOrderPlatformFees ? "Yes" : "No"}
              </p>
            </div>
          </DashboardSecondaryPanel>
        </div>
      </DashboardGrid>

      <DashboardPrimaryPanel>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="section-kicker">Test Business Audit</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
              Platform-owner test/demo businesses
            </h2>
          </div>
          <Link
            href="/admin/platform"
            className="btn-secondary px-4 py-2 text-sm font-medium"
          >
            Review cleanup
          </Link>
        </div>
        <div className="mt-5 space-y-3">
          {testBusinessCandidates.slice(0, 5).map((business) => (
            <div key={business.id} className="table-row-panel p-4">
              <p className="font-medium text-[var(--text-strong)]">{business.name}</p>
              <p className="mt-1 text-sm text-[var(--text-soft)]">
                {business.businessType || "business"} | {business.totalDependencies} dependent
                records
              </p>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                {business.dependencyCounts.length > 0
                  ? business.dependencyCounts
                      .slice(0, 4)
                      .map((item) => `${item.label}: ${item.count}`)
                      .join(" | ")
                  : "No known dependencies"}
              </p>
            </div>
          ))}
          {testBusinessCandidates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-8 text-sm text-[var(--text-soft)]">
              No likely test or demo businesses were detected for the platform-owner
              account.
            </div>
          ) : null}
        </div>
      </DashboardPrimaryPanel>
    </AdminPageContainer>
  );
}
