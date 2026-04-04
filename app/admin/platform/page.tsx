import Link from "next/link";
import { getPlatformAdminSession } from "@/lib/platformAdmin";
import { getPlatformSettings } from "@/lib/platformSettings";
import { getPlatformAdminData } from "@/lib/platformAdminData";
import {
  getPlatformIncomeAudit,
  getPlatformOwnerBusinessAudits,
  PLATFORM_OWNER_CLEANUP_SEQUENCE,
} from "@/lib/platformOwnerCleanup";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

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

export default async function PlatformPage() {
  const settings = await getPlatformSettings();
  const { user, isPlatformAdmin } = await getPlatformAdminSession();

  if (!isPlatformAdmin) {
    return (
      <div className="space-y-6 text-[var(--text-main)]">
        <section className="surface-card p-6">
          <div className="section-header-copy">
            <p className="section-kicker">Platform</p>
            <h1 className="section-title">Platform settings</h1>
            <p className="section-description">
              Editable SaaS copy and support information used across the app.
            </p>
          </div>
        </section>

        <div className="surface-panel border-yellow-500/20 px-4 py-3 text-sm text-yellow-100">
          Platform editing is restricted to accounts whose profile is marked as a platform admin.
        </div>

        <form action="/api/admin/platform" method="POST" className="surface-card space-y-5 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-gray-300">
              <span className="form-label">Platform name</span>
              <input
                name="platform_name"
                defaultValue={settings.platform_name}
                disabled
                className="input-field disabled:opacity-60"
              />
            </label>
            <label className="text-sm text-gray-300">
              <span className="form-label">Support email</span>
              <input
                name="support_email"
                defaultValue={settings.support_email}
                disabled
                className="input-field disabled:opacity-60"
              />
            </label>
          </div>
          <label className="text-sm text-gray-300">
            <span className="form-label">Headline</span>
            <input
              name="marketing_headline"
              defaultValue={settings.marketing_headline}
              disabled
              className="input-field disabled:opacity-60"
            />
          </label>
          <label className="text-sm text-gray-300">
            <span className="form-label">Subheadline</span>
            <textarea
              name="marketing_subheadline"
              defaultValue={settings.marketing_subheadline}
              disabled
              className="input-field min-h-[110px] disabled:opacity-60"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-gray-300">
              <span className="form-label">Support phone</span>
              <input
                name="support_phone"
                defaultValue={settings.support_phone}
                disabled
                className="input-field disabled:opacity-60"
              />
            </label>
            <label className="text-sm text-gray-300">
              <span className="form-label">Pricing note</span>
              <input
                name="pricing_note"
                defaultValue={settings.pricing_note}
                disabled
                className="input-field disabled:opacity-60"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            Save Platform Settings
          </button>
        </form>
      </div>
    );
  }

  const [platformData, cleanupAudits] = await Promise.all([
    getPlatformAdminData(),
    getPlatformOwnerBusinessAudits(user!.id),
  ]);
  const incomeAudit = getPlatformIncomeAudit();

  return (
    <div className="space-y-6 text-[var(--text-main)]">
      <section className="premium-card p-6 lg:p-7">
        <div className="section-header-copy">
          <p className="section-kicker">Platform Control</p>
          <h1 className="section-title">Platform-owner controls and business health</h1>
          <p className="section-description">
            Platform-owner controls, business health, support oversight, and dependency-aware cleanup reporting for businesses owned by this account.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {platformData.metrics.map((metric) => (
          <div key={metric.label} className="metric-card p-5">
            <p className="section-kicker">{metric.label}</p>
            <p className="mt-3 text-3xl font-semibold text-[var(--text-strong)]">{metric.value}</p>
            <p className="mt-2 text-sm text-[var(--text-soft)]">{metric.detail}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <div className="surface-card p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-kicker">Insights</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">Top performing businesses</h2>
            </div>
            <span className="text-sm text-[var(--text-soft)]">
              Platform-wide gross volume
            </span>
          </div>
          <div className="mt-5 space-y-3">
            {platformData.topPerformingBusinesses.slice(0, 8).map((business) => (
              <div key={business.id} className="table-row-panel p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-[var(--text-strong)]">{business.name}</p>
                    <p className="mt-1 text-sm text-[var(--text-soft)]">
                      {business.businessType || "business"} - {business.plan} plan
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      Owner {business.ownerEmail || "unknown"} - Last activity {formatDateTime(business.lastActivityAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[var(--text-strong)]">{formatCurrency(business.grossRevenue)}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{business.transactions} txns</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <section className="surface-card p-6">
            <p className="section-kicker">Income Audit</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">Real revenue posture</h2>
            <div className="mt-4 space-y-3 text-sm text-[var(--text-soft)]">
              <p>Projected MRR from plan assignments: {formatCurrency(platformData.totalMRR)}</p>
              <p>Known stored platform fees: {formatCurrency(platformData.transactionPlatformRevenue)}</p>
              <p>Subscription ledger table present: {incomeAudit.hasSubscriptionLedger ? "Yes" : "No"}</p>
              <p>Stored order platform fees: {incomeAudit.hasStoredOrderPlatformFees ? "Yes" : "No"}</p>
            </div>
            <div className="mt-4 space-y-2 text-xs text-[var(--text-muted)]">
              {incomeAudit.notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          </section>

          <section className="premium-card p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="section-kicker">Support</p>
                <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">Business-owner support</h2>
              </div>
              <Link href="/admin/messages" className="btn-secondary px-4 py-2 text-sm font-medium">
                Open inbox
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {platformData.supportThreads.slice(0, 5).map((thread) => (
                <div key={thread.id} className="table-row-panel p-4">
                  <p className="font-medium text-[var(--text-strong)]">{thread.businessName || "Business"}</p>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">
                    {thread.ownerEmail || "Owner"} - {thread.unreadForPlatform} unread
                  </p>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    {thread.lastMessageExcerpt || "No messages yet"}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
