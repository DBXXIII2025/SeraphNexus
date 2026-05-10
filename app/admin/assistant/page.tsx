import Link from "next/link";
import { redirect } from "next/navigation";
import AssistantChat from "@/components/assistant/AssistantChat";
import {
  buildAssistantContextSummary,
  loadAssistantActions,
  loadAssistantBusinessOptions,
  loadAssistantMessages,
  resolveAssistantAccess,
} from "@/lib/assistant";
import { createAdminTranslator } from "@/lib/adminI18n";
import { getPlanDefinition } from "@/lib/planConfig";
import {
  AdminPageContainer,
  DashboardGrid,
  DashboardPrimaryPanel,
  DashboardSecondaryPanel,
} from "@/components/admin/AdminLayoutSystem";

export const dynamic = "force-dynamic";

type SearchParams = {
  businessId?: string;
};

export default async function AdminAssistantPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const requestedBusinessId = String(params?.businessId || "").trim();
  const access = await resolveAssistantAccess(requestedBusinessId || undefined);

  if (!access.userId) {
    redirect("/login?next=%2Fadmin%2Fassistant");
  }

  if (access.isPlatformAdmin && access.missingBusinessSelection) {
    const businessOptions = await loadAssistantBusinessOptions();

    return (
      <AdminPageContainer className="text-[var(--text-main)]">
        <DashboardPrimaryPanel>
          <p className="section-kicker">AI Assistant</p>
          <h1 className="section-title">Select a business workspace</h1>
          <p className="section-description">
            Platform admin mode can test the assistant against a real business context without
            joining that tenant workspace directly.
          </p>
        </DashboardPrimaryPanel>

        <DashboardSecondaryPanel>
          {businessOptions.length === 0 ? (
            <div className="empty-state">No businesses are available for assistant testing.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {businessOptions.map((business) => (
                <Link
                  key={business.id}
                  href={`/admin/assistant?businessId=${encodeURIComponent(business.id)}`}
                  className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] p-4 transition hover:border-[var(--accent-border)] hover:bg-[var(--surface)]"
                >
                  <p className="text-sm uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {business.businessType}
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-[var(--text-strong)]">
                    {business.name}
                  </h2>
                  <p className="mt-2 text-sm text-[var(--text-soft)]">
                    Plan {business.plan} | {business.isPublished ? "Published" : "Not published"}
                  </p>
                  <p className="mt-3 text-xs text-[var(--accent-soft)]">
                    Open assistant workspace
                  </p>
                </Link>
              ))}
            </div>
          )}
        </DashboardSecondaryPanel>
      </AdminPageContainer>
    );
  }

  const business = access.business;
  const t = createAdminTranslator(null);

  if (!business) {
    return (
      <AdminPageContainer className="text-[var(--text-main)]">
        <DashboardPrimaryPanel>
          <p className="section-kicker">AI Assistant</p>
          <h1 className="section-title">No active business</h1>
          <p className="section-description">
            Select a business workspace before opening the assistant.
          </p>
        </DashboardPrimaryPanel>
      </AdminPageContainer>
    );
  }

  if (!access.canUseAssistant) {
    const plan = getPlanDefinition(business.plan);

    return (
      <AdminPageContainer className="text-[var(--text-main)]">
        <DashboardPrimaryPanel>
          <p className="section-kicker">Elite Feature</p>
          <h1 className="section-title">AI Assistant</h1>
          <p className="section-description">
            The AI Assistant is reserved for Elite workspaces. Your current plan for{" "}
            {business.name || "this business"} is {plan.label}.
          </p>
          <div className="mt-5 rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-muted)] p-5 text-sm text-[var(--accent-soft)]">
            Use Elite to unlock AI-guided operational coaching, platform walkthroughs, and
            read-only business analysis inside the admin workspace.
          </div>
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

  const [contextSummary, history, actionHistory, businessOptions] = await Promise.all([
    buildAssistantContextSummary(business),
    loadAssistantMessages({
      businessId: business.id,
      userId: access.userId!,
      limit: 40,
    }),
    loadAssistantActions({
      businessId: business.id,
      userId: access.userId!,
      limit: 24,
    }),
    access.isPlatformAdmin ? loadAssistantBusinessOptions() : Promise.resolve([]),
  ]);

  return (
    <AdminPageContainer className="text-[var(--text-main)]">
      <DashboardPrimaryPanel>
        <div className="section-header">
          <div className="section-header-copy">
            <p className="section-kicker">
              {access.isPlatformAdmin ? "Platform Override" : "Elite Feature"}
            </p>
            <h1 className="section-title">AI Assistant</h1>
            <p className="section-description">
              Business guidance plus approval-based action drafting for{" "}
              {business.name || "this business"} with safe workspace summaries only.
            </p>
          </div>
        </div>
      </DashboardPrimaryPanel>

      <DashboardGrid className="xl:grid-cols-[320px,1fr]">
        <DashboardSecondaryPanel>
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-muted)] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent-soft)]">
                Workspace
              </p>
              <h2 className="mt-2 text-lg font-semibold text-[var(--text-strong)]">
                {contextSummary.businessName}
              </h2>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                {contextSummary.businessType}
                {contextSummary.serviceCategory ? ` | ${contextSummary.serviceCategory}` : ""}
              </p>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                Plan {contextSummary.plan} |{" "}
                {contextSummary.published ? "Published" : "Not published"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Services
                </p>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">
                  {contextSummary.counts.services ?? "-"}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Products
                </p>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">
                  {contextSummary.counts.products ?? "-"}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Inventory
                </p>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">
                  {contextSummary.counts.rentalsOrProperties ?? "-"}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Orders
                </p>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">
                  {contextSummary.counts.orders ?? "-"}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] p-4 text-sm text-[var(--text-soft)]">
              <p>
                Bookings or reservations:{" "}
                <span className="text-[var(--text-strong)]">
                  {contextSummary.counts.bookingsOrReservations ?? "-"}
                </span>
              </p>
              <p className="mt-2">
                Customer conversation threads:{" "}
                <span className="text-[var(--text-strong)]">
                  {contextSummary.counts.customerConversationThreads ?? "-"}
                </span>
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] p-4 text-sm text-[var(--text-soft)]">
              The assistant can draft controlled actions for review. Nothing executes until you
              approve it, and restricted operations stay blocked.
            </div>
          </div>
        </DashboardSecondaryPanel>

        <DashboardPrimaryPanel className="p-0">
          <AssistantChat
            businessId={business.id}
            businessName={contextSummary.businessName}
            initialMessages={history.messages}
            initialActions={actionHistory.actions}
            initialError={history.storageError}
            initialActionError={actionHistory.storageError}
            isPlatformAdmin={access.isPlatformAdmin}
            businessOptions={businessOptions}
            selectedBusinessId={business.id}
          />
        </DashboardPrimaryPanel>
      </DashboardGrid>
    </AdminPageContainer>
  );
}
