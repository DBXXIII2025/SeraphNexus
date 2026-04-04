import Link from "next/link";
import { getPlatformAdminData } from "@/lib/platformAdminData";

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

export default async function PlatformAdminOverviewPage() {
  const data = await getPlatformAdminData();

  return (
    <div className="space-y-6 text-[var(--text-main)]">
      <section className="premium-card p-6 lg:p-7">
        <div className="section-header">
          <div className="section-header-copy">
            <p className="section-kicker">Platform Overview</p>
            <h1 className="section-title">Operate the platform from one cohesive control surface</h1>
            <p className="section-description">
              Monitor growth, support load, revenue posture, and business health from the same visual system used across Explore and owner operations.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.metrics.map((metric) => (
          <div key={metric.label} className="metric-card p-6">
            <p className="section-kicker">{metric.label}</p>
            <p
              className={`mt-5 text-4xl font-semibold ${
                metric.tone === "success"
                  ? "text-[var(--accent-gold-soft)]"
                  : metric.tone === "alert"
                    ? "text-[var(--accent-soft)]"
                    : "text-[var(--text-strong)]"
              }`}
            >
              {metric.value}
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">{metric.detail}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr,0.95fr]">
        <div className="surface-card p-6">
          <div className="section-header">
            <div className="section-header-copy">
              <p className="section-kicker">Recent Signups</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
                New businesses
              </h2>
            </div>
            <Link href="/platform-admin/businesses" className="btn-secondary px-4 py-2 text-sm font-medium">
              View businesses
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {data.recentBusinessSignups.map((business) => (
              <div key={business.id} className="table-row-panel p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-[var(--text-strong)]">{business.name}</p>
                    <p className="mt-1 text-sm text-[var(--text-soft)]">
                      {business.businessType || "business"} - {business.plan} plan
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      Owner {business.ownerEmail || "unknown"} - Created {formatDateTime(business.createdAt)}
                    </p>
                  </div>
                  <span className="status-chip">
                    {business.stripeReady ? "Stripe ready" : "Needs setup"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <section className="premium-card p-6">
            <div className="section-header">
              <div className="section-header-copy">
                <p className="section-kicker">Support</p>
                <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
                  Support queue
                </h2>
              </div>
              <Link href="/platform-admin/messages" className="btn-secondary px-4 py-2 text-sm font-medium">
                Open inbox
              </Link>
            </div>
            <div className="mt-5 space-y-3">
              {data.supportThreads.slice(0, 5).map((thread) => (
                <div key={thread.id} className="table-row-panel p-4">
                  <p className="font-medium text-[var(--text-strong)]">
                    {thread.businessName || "Business"} - {thread.ownerEmail || "Owner"}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">
                    {thread.lastMessageExcerpt || "No messages yet"}
                  </p>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    {thread.unreadForPlatform} unread - {formatDateTime(thread.lastMessageAt)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="surface-card p-6">
            <p className="section-kicker">Attention</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
              Blockers
            </h2>
            <div className="mt-5 space-y-3">
              <div className="table-row-panel p-4">
                <p className="text-sm text-[var(--text-soft)]">
                  Businesses needing attention:{" "}
                  <span className="text-[var(--text-strong)]">
                    {data.businessesNeedingAttention.length}
                  </span>
                </p>
              </div>
              <div className="table-row-panel p-4">
                <p className="text-sm text-[var(--text-soft)]">
                  Inactive businesses:{" "}
                  <span className="text-[var(--text-strong)]">{data.inactiveBusinesses.length}</span>
                </p>
              </div>
              <div className="table-row-panel p-4">
                <p className="text-sm text-[var(--text-soft)]">
                  Known platform fee revenue:{" "}
                  <span className="text-[var(--text-strong)]">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                    }).format(data.transactionPlatformRevenue)}
                  </span>
                </p>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  Based on records that currently store a platform fee directly.
                </p>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
