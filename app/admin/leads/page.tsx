import Link from "next/link";
import { redirect } from "next/navigation";
import LeadActivityFeed from "@/components/admin/LeadActivityFeed";
import LeadFollowUpPanel from "@/components/admin/LeadFollowUpPanel";
import LeadStatsCards from "@/components/admin/LeadStatsCards";
import { getBusinessModule } from "@/lib/businessModules";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import {
  buildLeadDashboardData,
  fetchLeadEventsForBusiness,
  getLeadEmptyStateSuggestions,
} from "@/lib/leads";
import { canAccessPlanFeature, getPlanDefinition } from "@/lib/planConfig";
import { createClient } from "@/lib/supabase/server";
import { createAdminTranslator } from "@/lib/adminI18n";
import {
  AdminPageContainer,
  DashboardGrid,
  DashboardPrimaryPanel,
} from "@/components/admin/AdminLayoutSystem";

export const dynamic = "force-dynamic";

export default async function AdminLeadsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=%2Fadmin%2Fleads");
  }

  const business = await getActiveBusiness();

  if (!business) {
    const t = createAdminTranslator(null);
    return (
      <AdminPageContainer className="text-[var(--text-main)]">
        <DashboardPrimaryPanel>
          <h1 className="text-2xl font-semibold text-[var(--text-strong)]">{t("leads")}</h1>
          <p className="mt-3 text-sm text-[var(--text-soft)]">
            Select or create a business to view lead activity and visitor analytics.
          </p>
        </DashboardPrimaryPanel>
      </AdminPageContainer>
    );
  }

  const t = createAdminTranslator(business.language);

  if (!canAccessPlanFeature(business.plan, "lead_capture")) {
    const plan = getPlanDefinition(business.plan);

    return (
      <AdminPageContainer className="text-[var(--text-main)]">
        <DashboardPrimaryPanel>
          <h1 className="text-2xl font-semibold text-[var(--text-strong)]">{t("leads")}</h1>
          <p className="mt-3 text-sm text-[var(--text-soft)]">
            Lead capture is available on Pro and Elite plans. Your current plan is {plan.label}.
          </p>
          <Link
            href="/admin/upgrade"
            className="btn-primary mt-5 inline-flex px-4 py-2 text-sm font-medium"
          >
            {t("upgrade")}
          </Link>
        </DashboardPrimaryPanel>
      </AdminPageContainer>
    );
  }

  const events = await fetchLeadEventsForBusiness(supabase, business.id);
  const dashboard = buildLeadDashboardData(events, {
    businessId: business.id,
    businessType: business.business_type,
  });
  const businessModule = getBusinessModule(business.business_type);
  const emptyStateSuggestions = getLeadEmptyStateSuggestions(business.business_type);

  return (
    <AdminPageContainer className="text-[var(--text-main)]">
      <DashboardPrimaryPanel>
        <div className="relative grid gap-6 xl:grid-cols-[1.5fr,0.9fr]">
          <div>
            <p className="section-kicker">{t("leads")}</p>
            <h1 className="mt-3 text-3xl font-semibold text-[var(--text-strong)] lg:text-[2.35rem]">
              Lead intelligence console
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-soft)]">
              Real lead signals for {business.name || "your business"} are grouped here into a
              clean follow-up workflow for the active {businessModule.label.toLowerCase()} workspace.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--destructive-border)] bg-[var(--destructive-bg)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Needs Follow-Up
              </p>
              <p className="mt-2 text-3xl font-semibold text-[var(--accent-soft)]">
                {dashboard.summary.needsFollowUpLeads}
              </p>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                Open leads that still need owner action.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-muted)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                High Priority
              </p>
              <p className="mt-2 text-3xl font-semibold text-[var(--accent-soft)]">
                {dashboard.summary.highPriorityLeads}
              </p>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                Leads showing direct conversation or transaction intent.
              </p>
            </div>
          </div>
        </div>
      </DashboardPrimaryPanel>

      <LeadStatsCards summary={dashboard.summary} />

      {dashboard.events.length === 0 ? (
        <DashboardPrimaryPanel className="border-dashed p-8">
          <h2 className="text-xl font-semibold text-[var(--text-strong)]">No lead events yet</h2>
          <p className="mt-3 max-w-2xl text-sm text-[var(--text-soft)]">
            Lead activity will appear here once visitors view pages, click message entry points,
            send guest messages, or start booking, reservation, or checkout flows for this business.
          </p>
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {emptyStateSuggestions.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] p-4 text-sm text-[var(--text-soft)]"
              >
                {item}
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/admin/messages" className="btn-secondary px-4 py-2 text-sm font-medium">
              {t("messages")}
            </Link>
            <Link
              href={businessModule.primaryAdminHref}
              className="btn-primary px-4 py-2 text-sm font-medium"
            >
              {t("open")} {businessModule.primaryAdminLabel}
            </Link>
          </div>
        </DashboardPrimaryPanel>
      ) : (
        <DashboardGrid className="dashboard-grid-shell xl:grid-cols-[1.4fr,0.92fr]">
          <div className="space-y-6">
            <LeadActivityFeed items={dashboard.recentActivity} />
          </div>
          <div className="space-y-6">
            <LeadFollowUpPanel
              businessId={business.id}
              visitors={dashboard.visitorSummaries}
              topSources={dashboard.topSources}
              topPages={dashboard.topPages}
              statusBreakdown={dashboard.statusBreakdown}
              sourceTypeBreakdown={dashboard.sourceTypeBreakdown}
            />
          </div>
        </DashboardGrid>
      )}
    </AdminPageContainer>
  );
}
