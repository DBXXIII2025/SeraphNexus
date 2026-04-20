import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { isRentalBusinessType } from "@/lib/businessModules";
import { getPlatformAdminSession } from "@/lib/platformAdmin";
import { getPlatformAdminData } from "@/lib/platformAdminData";
import {
  resolveBookingGrossAmount,
  resolveBookingPlatformFee,
  resolveOrderGrossAmount,
  resolveOrderPlatformFee,
  resolveRentalGrossAmount,
  resolveRentalPlatformFee,
} from "@/lib/paymentMath";
import { applyVisibleFilter } from "@/lib/transactionVisibility";

type OrderRow = {
  total_amount?: number | null;
  platform_fee?: number | null;
  created_at?: string | null;
  payment_status?: string | null;
};

type BookingRow = {
  amount_total?: number | null;
  total_amount?: number | null;
  amount?: number | null;
  platform_fee?: number | null;
  created_at?: string | null;
  payment_status?: string | null;
};

type RentalReservationRow = {
  amount_total?: number | null;
  platform_fee?: number | null;
  created_at?: string | null;
  payment_status?: string | null;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
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

async function PlatformOwnerRevenuePage() {
  const data = await getPlatformAdminData();

  console.info("[admin/revenue] resolved admin mode", {
    mode: "platform engineer",
    platformControlsVisible: true,
    canonicalControlCenter: "/admin",
  });

  return (
    <div className="space-y-6 text-[var(--text-main)]">
      <section className="surface-card p-6">
        <div className="section-header">
          <div className="section-header-copy">
            <p className="section-kicker">Revenue</p>
            <h1 className="section-title">Track platform revenue with cleaner operational hierarchy</h1>
            <p className="section-description">
              Review paid activity, plan mix, and top-performing businesses from the canonical admin control center.
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

export default async function RevenuePage() {
  const { isPlatformAdmin } = await getPlatformAdminSession();

  if (isPlatformAdmin) {
    return <PlatformOwnerRevenuePage />;
  }

  const supabase = await createClient();
  const business = await getActiveBusiness();

  if (!business) {
    return <div className="empty-state">No active business.</div>;
  }

  const isRental = isRentalBusinessType(business.business_type);

  const [ordersResult, bookingsResult, reservationsResult] = await Promise.all([
    isRental
      ? Promise.resolve({ data: [] as OrderRow[] })
      : applyVisibleFilter(
          supabase
            .from("orders")
            .select("*")
            .eq("business_id", business.id)
        ),
    isRental
      ? Promise.resolve({ data: [] as BookingRow[] })
      : applyVisibleFilter(
          supabase
            .from("bookings")
            .select("amount_total, total_amount, amount, platform_fee, created_at, payment_status")
            .eq("business_id", business.id)
        ),
    isRental
      ? applyVisibleFilter(
          supabase
            .from("rental_reservations")
            .select("amount_total, platform_fee, created_at, payment_status")
            .eq("business_id", business.id)
        )
      : Promise.resolve({ data: [] as RentalReservationRow[] }),
  ]);

  const paidOrderRows = (ordersResult.data || []).filter(
    (row) => row.payment_status === "paid"
  );
  const paidBookingRows = (bookingsResult.data || []).filter(
    (row) => row.payment_status === "paid"
  );
  const paidReservationRows = (reservationsResult.data || []).filter(
    (row) => row.payment_status === "paid"
  );

  const totalRevenue =
    paidOrderRows.reduce((sum, row) => sum + resolveOrderGrossAmount(row.total_amount), 0) +
    paidBookingRows.reduce((sum, row) => sum + resolveBookingGrossAmount(row), 0) +
    paidReservationRows.reduce(
      (sum, row) => sum + resolveRentalGrossAmount(row.amount_total),
      0
    );

  const platformRevenue =
    paidOrderRows.reduce((sum, row) => sum + resolveOrderPlatformFee(row.platform_fee), 0) +
    paidBookingRows.reduce(
      (sum, row) => sum + resolveBookingPlatformFee(row.platform_fee),
      0
    ) +
    paidReservationRows.reduce(
      (sum, row) => sum + resolveRentalPlatformFee(row.platform_fee),
      0
    );

  const netRevenue = totalRevenue - platformRevenue;
  const recentRows = [
    ...paidOrderRows.map((row) => ({
      createdAt: row.created_at,
      gross: resolveOrderGrossAmount(row.total_amount),
      fee: resolveOrderPlatformFee(row.platform_fee),
      label: "Order",
    })),
    ...paidBookingRows.map((row) => ({
      createdAt: row.created_at,
      gross: resolveBookingGrossAmount(row),
      fee: resolveBookingPlatformFee(row.platform_fee),
      label: "Booking",
    })),
    ...paidReservationRows.map((row) => ({
      createdAt: row.created_at,
      gross: resolveRentalGrossAmount(row.amount_total),
      fee: resolveRentalPlatformFee(row.platform_fee),
      label: "Reservation",
    })),
  ]
    .sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    )
    .slice(0, 10);

  return (
    <div className="space-y-6 text-[var(--text-main)]">
      <section className="premium-card p-6 lg:p-7">
        <p className="section-kicker">Revenue</p>
        <h1 className="mt-3 text-3xl font-semibold text-[var(--text-strong)] lg:text-[2.2rem]">
          Revenue dashboard
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">
          Paid transaction volume, platform fees, and net earnings for the active business.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="metric-card p-5">
          <p className="section-kicker">Total sales</p>
          <p className="mt-4 text-[1.95rem] font-semibold text-[var(--text-strong)]">
            {formatCurrency(totalRevenue)}
          </p>
        </div>

        <div className="metric-card p-5">
          <p className="section-kicker">Platform fees</p>
          <p className="mt-4 text-[1.95rem] font-semibold text-[var(--accent-soft)]">
            {formatCurrency(platformRevenue)}
          </p>
        </div>

        <div className="metric-card p-5">
          <p className="section-kicker">Net earnings</p>
          <p className="mt-4 text-[1.95rem] font-semibold text-[var(--accent-gold-soft)]">
            {formatCurrency(netRevenue)}
          </p>
        </div>
      </div>

      <section className="surface-card p-6">
        <p className="section-kicker">Recent paid activity</p>
        <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
          Settlement ledger
        </h2>

        <div className="mt-5 space-y-3">
          {recentRows.length === 0 ? (
            <div className="empty-state">No paid transactions yet.</div>
          ) : (
            recentRows.map((row, index) => (
              <div key={`${row.label}-${row.createdAt || index}`} className="table-row-panel p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-[var(--text-strong)]">{row.label}</p>
                    <p className="mt-1 text-sm text-[var(--text-soft)]">
                      Fee {formatCurrency(row.fee)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[var(--text-strong)]">
                      {formatCurrency(row.gross)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {row.createdAt ? new Date(row.createdAt).toLocaleString() : "No timestamp"}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
