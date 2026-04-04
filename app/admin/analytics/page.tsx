import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { canAccessPlanFeature, getPlanDefinition } from "@/lib/planConfig";
import { applyVisibleFilter } from "@/lib/transactionVisibility";

export default async function AdminAnalyticsPage() {
  const supabase = await createClient();
  const business = await getActiveBusiness();

  if (!business) {
    return <div className="empty-state">No active business.</div>;
  }

  const businessName = (business as { name?: string | null }).name || "your business";

  if (!canAccessPlanFeature(business.plan, "advanced_analytics")) {
    const plan = getPlanDefinition(business.plan);

    return (
      <div className="space-y-6 text-[var(--text-main)]">
        <section className="surface-card p-6">
          <div className="section-header-copy">
            <p className="section-kicker">Analytics</p>
            <h1 className="section-title">Performance snapshots</h1>
            <p className="section-description">
              Performance insights for {businessName}.
            </p>
          </div>
        </section>

        <section className="premium-card p-6">
          <p className="section-kicker">Plan Gate</p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
            Advanced analytics require a higher plan
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">
            Advanced analytics are available on Pro and Elite plans. Your current plan is {plan.label}.
          </p>
          <Link href="/admin/upgrade" className="btn-primary mt-5 px-4 py-2 text-sm font-medium">
            Upgrade plan
          </Link>
        </section>
      </div>
    );
  }

  const { data: bookings, error } = await applyVisibleFilter(
    supabase
      .from("bookings")
      .select("date, start_time, end_time, status")
  );

  if (error) {
    return (
      <div className="surface-card p-6 text-red-300">
        Failed to load analytics.
      </div>
    );
  }

  const safeBookings = bookings ?? [];
  const total = safeBookings.length;
  const confirmed = safeBookings.filter((b) => b.status === "confirmed").length;
  const cancelled = safeBookings.filter((b) => b.status === "cancelled").length;

  const today = new Date();
  const upcoming = safeBookings.filter((b) => {
    if (!b.date) return false;
    const start = new Date(`${b.date}T${b.start_time || "00:00"}`);
    return start >= today && b.status === "confirmed";
  }).length;

  return (
    <main className="space-y-6 text-[var(--text-main)]">
      <section className="premium-card p-6 lg:p-7">
        <div className="section-header-copy">
          <p className="section-kicker">Analytics</p>
          <h1 className="section-title">Performance snapshots for {businessName}</h1>
          <p className="section-description">
            Use this view to monitor booking volume, confirmed activity, cancellations, and near-term demand without leaving the owner workspace.
          </p>
        </div>
      </section>

      <section className="grid max-w-5xl gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat title="Total bookings" value={total} />
        <Stat title="Confirmed" value={confirmed} tone="success" />
        <Stat title="Cancelled" value={cancelled} tone="alert" />
        <Stat title="Upcoming" value={upcoming} />
      </section>
    </main>
  );
}

function Stat({
  title,
  value,
  tone = "default",
}: {
  title: string;
  value: number;
  tone?: "default" | "success" | "alert";
}) {
  const valueClass =
    tone === "success"
      ? "text-[var(--accent-gold-soft)]"
      : tone === "alert"
        ? "text-[var(--accent-soft)]"
        : "text-[var(--text-strong)]";

  return (
    <div className="metric-card p-5">
      <p className="section-kicker">{title}</p>
      <p className={`mt-4 text-[1.95rem] font-semibold leading-none ${valueClass}`}>{value}</p>
    </div>
  );
}
