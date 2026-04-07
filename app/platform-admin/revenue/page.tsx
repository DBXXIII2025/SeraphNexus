import { getPlatformAdminData } from "@/lib/platformAdminData";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
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

export default async function PlatformAdminRevenuePage() {
  const data = await getPlatformAdminData();

  return (
    <div className="space-y-6 text-[var(--text-main)]">
      <section className="surface-card p-6">
        <div className="section-header">
          <div className="section-header-copy">
            <p className="section-kicker">Revenue</p>
            <h1 className="section-title">Track platform revenue with cleaner operational hierarchy</h1>
            <p className="section-description">
              Review paid activity, plan mix, and top-performing businesses without switching visual systems.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card p-6">
          <p className="section-kicker">Projected MRR</p>
          <p className="mt-5 text-4xl font-semibold text-[var(--accent-gold-soft)]">
            {formatCurrency(data.totalMRR)}
          </p>
          <p className="mt-3 text-sm text-[var(--text-soft)]">
            Derived from current paid business plans.
          </p>
        </div>
        <div className="metric-card p-6">
          <p className="section-kicker">Gross Volume</p>
          <p className="mt-5 text-4xl font-semibold text-[var(--text-strong)]">
            {formatCurrency(data.transactionGrossRevenue)}
          </p>
          <p className="mt-3 text-sm text-[var(--text-soft)]">
            Paid transaction volume across orders, bookings, and reservations.
          </p>
        </div>
        <div className="metric-card p-6">
          <p className="section-kicker">Platform Revenue</p>
          <p className="mt-5 text-4xl font-semibold text-[var(--accent-soft)]">
            {formatCurrency(data.transactionPlatformRevenue)}
          </p>
          <p className="mt-3 text-sm text-[var(--text-soft)]">
            Transaction-fee revenue from paid platform activity.
          </p>
        </div>
        <div className="metric-card p-6">
          <p className="section-kicker">Plan Distribution</p>
          <p className="mt-5 text-4xl font-semibold text-[var(--text-strong)]">
            {data.planDistribution.reduce((sum, plan) => sum + plan.count, 0)}
          </p>
          <p className="mt-3 text-sm text-[var(--text-soft)]">
            Businesses currently assigned to plan tiers.
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr,1fr]">
        <div className="surface-card p-6">
          <p className="section-kicker">Recent Payments</p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
            Paid transaction feed
          </h2>
          <div className="mt-5 space-y-3">
            {data.recentTransactions.map((row) => (
              <div key={`${row.sourceType}-${row.id}`} className="table-row-panel p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-[var(--text-strong)]">
                      {row.businessName} - {row.sourceType}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-soft)]">
                      Gross {formatCurrency(row.grossAmount)} - Platform {formatCurrency(row.platformFee)}
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      {formatDateTime(row.createdAt)} - {row.paymentStatus || row.status || "unknown"}
                    </p>
                  </div>
                  <span className="status-chip">{row.sourceType}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <section className="premium-card p-6">
            <p className="section-kicker">Top Grossing</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
              Top businesses
            </h2>
            <div className="mt-5 space-y-3">
              {data.topPerformingBusinesses.slice(0, 8).map((business) => (
                <div key={business.id} className="table-row-panel p-4">
                  <p className="font-medium text-[var(--text-strong)]">{business.name}</p>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">
                    Gross {formatCurrency(business.grossRevenue)} - Platform {formatCurrency(business.platformRevenue)}
                  </p>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    {business.transactions} transactions - effective {business.effectivePlan} plan
                    {business.effectivePlan !== business.storedPlan
                      ? ` | stored ${business.storedPlan}`
                      : ""}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="surface-card p-6">
            <p className="section-kicker">Plan Mix</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
              Distribution
            </h2>
            <div className="mt-5 space-y-3">
              {data.planDistribution.map((plan) => (
                <div key={plan.label} className="flex items-center justify-between rounded-2xl border border-[var(--border-soft)] bg-[rgba(15,12,12,0.52)] px-4 py-3">
                  <p className="text-[var(--text-strong)]">{plan.label}</p>
                  <span className="text-sm text-[var(--text-soft)]">{plan.count}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
