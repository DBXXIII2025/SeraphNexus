import Link from "next/link";
import PerformanceAnalyticsClient from "@/app/admin/analytics/PerformanceAnalyticsClient";
import type { AnalyticsMetric } from "@/lib/adminAnalytics";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { canAccessPlanFeature, getPlanDefinition } from "@/lib/planConfig";
import { createAdminTranslator } from "@/lib/adminI18n";

function getDefaultMetric(businessType: string | null | undefined): AnalyticsMetric {
  if (
    businessType === "restaurant" ||
    businessType === "food" ||
    businessType === "store" ||
    businessType === "creator" ||
    businessType === "product"
  ) {
    return "orders";
  }

  return "bookings";
}

export default async function AdminAnalyticsPage() {
  const business = await getActiveBusiness();

  if (!business) {
    return <div className="empty-state">{createAdminTranslator(null)("noActiveBusinessFound")}</div>;
  }

  const t = createAdminTranslator(business.language);
  const businessName = (business as { name?: string | null }).name || "your business";

  if (!canAccessPlanFeature(business.plan, "basic_analytics")) {
    const plan = getPlanDefinition(business.plan);

    return (
      <div className="space-y-6 text-[var(--text-main)]">
        <section className="surface-card p-6">
          <div className="section-header-copy">
            <p className="section-kicker">{t("analytics")}</p>
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
            {t("upgrade")}
          </Link>
        </section>
      </div>
    );
  }

  const canUseAdvancedAnalytics = canAccessPlanFeature(
    business.plan,
    "advanced_analytics"
  );

  return (
    <main className="space-y-6 text-[var(--text-main)]">
      <section className="premium-card p-6 lg:p-7">
        <div className="section-header-copy">
          <p className="section-kicker">{t("analytics")}</p>
          <h1 className="section-title">Performance snapshots for {businessName}</h1>
          <p className="section-description">
            Use this view to monitor daily performance, transaction flow, completion trend, and
            cancellation pressure without leaving the owner workspace.
          </p>
        </div>
      </section>

      <PerformanceAnalyticsClient
        businessId={business.id}
        businessName={businessName}
        planLabel={getPlanDefinition(business.plan).label}
        supportsAdvancedAnalytics={canUseAdvancedAnalytics}
        defaultMetric={getDefaultMetric(business.business_type)}
        defaultRange="30d"
      />

      <section className="surface-card p-6">
        <p className="section-kicker">{t("analytics")}</p>
        <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
          Customer insights and trend views
        </h2>

        {canUseAdvancedAnalytics ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="metric-card p-5">
              <p className="section-kicker">Elite ready</p>
              <p className="mt-4 text-[1.95rem] font-semibold text-[var(--accent-soft)]">
                Enabled
              </p>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                This workspace can take on future breakdowns like source attribution, cohorts, and
                conversion analysis without revisiting plan gates.
              </p>
            </div>
            <div className="metric-card p-5">
              <p className="section-kicker">Next expansion</p>
              <p className="mt-4 text-[1.95rem] font-semibold text-[var(--text-strong)]">
                Cohorts
              </p>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                Elite is prepared for deeper retention, customer mix, and trend segmentation later.
              </p>
            </div>
            <div className="metric-card p-5">
              <p className="section-kicker">Current foundation</p>
              <p className="mt-4 text-[1.95rem] font-semibold text-[var(--accent-soft)]">
                Live
              </p>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                The core graph is already normalized across bookings, orders, reservations, and
                revenue.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-muted)] px-4 py-4 text-sm text-[var(--accent-soft)]">
            Elite adds advanced analytics, customer insight views, trend reporting, and richer
            conversion monitoring.
            <Link href="/admin/upgrade" className="btn-secondary ml-4 inline-flex px-4 py-2 text-sm font-medium">
              {t("upgrade")}
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
