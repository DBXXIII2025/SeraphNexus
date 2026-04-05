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

  if (!canAccessPlanFeature(business.plan, "basic_analytics")) {
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
            Analytics are available on Pro and Elite plans. Your current plan is {plan.label}.
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
  const completionRate = total > 0 ? Math.round((confirmed / total) * 100) : 0;

  const today = new Date();
  const upcoming = safeBookings.filter((b) => {
    if (!b.date) return false;
    const start = new Date(`${b.date}T${b.start_time || "00:00"}`);
    return start >= today && b.status === "confirmed";
  }).length;
  const canUseAdvancedAnalytics = canAccessPlanFeature(
    business.plan,
    "advanced_analytics"
  );
  const daysWithBookings = new Set(
    safeBookings
      .map((booking) => booking.date || "")
      .filter(Boolean)
  ).size;

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

      <section className="surface-card p-6">
        <p className="section-kicker">Performance</p>
        <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
          Core analytics
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Stat title="Completion rate" value={`${completionRate}%`} />
          <Stat title="Active booking days" value={daysWithBookings} />
          <Stat title="Current plan" value={getPlanDefinition(business.plan).label} />
        </div>
      </section>

      <section className="surface-card p-6">
        <p className="section-kicker">Advanced Analytics</p>
        <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
          Customer insights and trend views
        </h2>

        {canUseAdvancedAnalytics ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Stat
              title="Conversion posture"
              value={`${completionRate}%`}
              tone={completionRate >= 60 ? "success" : "default"}
            />
            <Stat title="Upcoming demand" value={upcoming} />
            <Stat title="Cancellation pressure" value={`${cancelled}`} tone="alert" />
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-[rgba(212,175,55,0.18)] bg-[rgba(212,175,55,0.08)] px-4 py-4 text-sm text-[var(--accent-gold-soft)]">
            Elite adds advanced analytics, customer insight views, trend reporting, and richer
            conversion monitoring.
            <Link href="/admin/upgrade" className="btn-secondary ml-4 inline-flex px-4 py-2 text-sm font-medium">
              Upgrade to Elite
            </Link>
          </div>
        )}
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
