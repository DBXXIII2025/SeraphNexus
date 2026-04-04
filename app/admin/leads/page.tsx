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
    return (
      <div className="surface-card p-6 text-[var(--text-main)]">
        <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Leads</h1>
        <p className="mt-3 text-sm text-[var(--text-soft)]">
          Select or create a business to view lead activity and visitor analytics.
        </p>
      </div>
    );
  }

  if (!canAccessPlanFeature(business.plan, "lead_capture")) {
    const plan = getPlanDefinition(business.plan);

    return (
      <div className="premium-card p-6 text-[var(--text-main)]">
        <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Leads</h1>
        <p className="mt-3 text-sm text-[var(--text-soft)]">
          Lead capture is available on Pro and Elite plans. Your current plan is {plan.label}.
        </p>
        <Link
          href="/admin/upgrade"
          className="btn-primary mt-5 inline-flex px-4 py-2 text-sm font-medium"
        >
          Upgrade Plan
        </Link>
      </div>
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
    <div className="space-y-6 text-[var(--text-main)]">
      <section className="premium-card overflow-hidden p-6 lg:p-7">
        <div className="relative grid gap-6 xl:grid-cols-[1.5fr,0.9fr]">
          <div>
            <p className="section-kicker">Lead Command</p>
            <h1 className="mt-3 text-3xl font-semibold text-[var(--text-strong)] lg:text-[2.35rem]">
              Lead intelligence console
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-soft)]">
              Real lead signals for {business.name || "your business"} are grouped here into a
              clean follow-up workflow for the active {businessModule.label.toLowerCase()} workspace.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[rgba(193,18,31,0.2)] bg-[rgba(193,18,31,0.1)] p-4">
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
            <div className="rounded-2xl border border-[rgba(212,175,55,0.18)] bg-[rgba(212,175,55,0.08)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                High Priority
              </p>
              <p className="mt-2 text-3xl font-semibold text-[var(--accent-gold-soft)]">
                {dashboard.summary.highPriorityLeads}
              </p>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                Leads showing direct conversation or transaction intent.
              </p>
            </div>
          </div>
        </div>
      </section>

      <LeadStatsCards summary={dashboard.summary} />

      {dashboard.events.length === 0 ? (
        <div className="surface-card border-dashed p-8">
          <h2 className="text-xl font-semibold text-[var(--text-strong)]">No lead events yet</h2>
          <p className="mt-3 max-w-2xl text-sm text-[var(--text-soft)]">
            Lead activity will appear here once visitors view pages, click message entry points,
            send guest messages, or start booking, reservation, or checkout flows for this business.
          </p>
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {emptyStateSuggestions.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(15,12,12,0.52)] p-4 text-sm text-[var(--text-soft)]"
              >
                {item}
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/admin/messages" className="btn-secondary px-4 py-2 text-sm font-medium">
              Open Messages
            </Link>
            <Link
              href={businessModule.primaryAdminHref}
              className="btn-primary px-4 py-2 text-sm font-medium"
            >
              Open {businessModule.primaryAdminLabel}
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.4fr,0.92fr]">
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
        </div>
      )}
    </div>
  );
}
