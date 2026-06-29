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
import { EmptyState, SectionHeader, StatCard } from "@/components/ui/app-ui";

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
          <SectionHeader
            eyebrow={t("leads")}
            title="Lead intelligence console"
            description="Select or create a business to view lead activity and visitor analytics."
          />
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
          <SectionHeader
            eyebrow={t("leads")}
            title="Lead capture needs a higher plan"
            description={`Lead capture is available on Pro and Elite plans. Your current plan is ${plan.label}.`}
            actions={
              <Link href="/admin/upgrade" className="btn-primary px-4 py-2 text-sm font-medium">
                {t("upgrade")}
              </Link>
            }
          />
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
          <SectionHeader
            eyebrow={t("leads")}
            title="Lead intelligence console"
            description={`Real lead signals for ${business.name || "your business"} are grouped here into a clean follow-up workflow for the active ${businessModule.label.toLowerCase()} workspace.`}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard
              label="Needs Follow-Up"
              value={dashboard.summary.needsFollowUpLeads}
              detail="Open leads that still need owner action."
              tone="warning"
            />
            <StatCard
              label="High Priority"
              value={dashboard.summary.highPriorityLeads}
              detail="Leads showing direct conversation or transaction intent."
              tone="success"
            />
          </div>
        </div>
      </DashboardPrimaryPanel>

      <LeadStatsCards summary={dashboard.summary} />

      {dashboard.events.length === 0 ? (
        <DashboardPrimaryPanel className="border-dashed p-8">
          <EmptyState
            title="No lead events yet"
            description="Lead activity will appear here once visitors view pages, click message entry points, send guest messages, or start booking, reservation, or checkout flows for this business."
          />
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {emptyStateSuggestions.map((item) => (
              <div
                key={item}
                className="dashboard-secondary-panel text-sm text-[var(--text-soft)]"
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
