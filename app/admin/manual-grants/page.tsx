import { redirect } from "next/navigation";
import { getPlatformAdminSession } from "@/lib/platformAdmin";
import { getActiveAccessGrantList } from "@/lib/accessGrantAdmin";
import { getActivePlanGrantList } from "@/lib/planGrantAdmin";
import {
  AdminPageContainer,
  DashboardPrimaryPanel,
  DashboardSecondaryPanel,
} from "@/components/admin/AdminLayoutSystem";

export default async function AdminManualGrantsPage() {
  const { isPlatformAdmin } = await getPlatformAdminSession();

  if (!isPlatformAdmin) {
    redirect("/admin");
  }

  const [activeGrants, activePlanGrants] = await Promise.all([
    getActiveAccessGrantList(),
    getActivePlanGrantList(),
  ]);

  return (
    <AdminPageContainer className="text-[var(--text-main)]">
      <DashboardPrimaryPanel>
        <div className="section-header-copy">
          <p className="section-kicker">Platform</p>
          <h1 className="section-title">Manual grants</h1>
          <p className="section-description">
            Track Starter access grants and manual plan overrides without scanning the full platform
            control page.
          </p>
        </div>
        <a href="/admin/platform" className="btn-primary mt-5 inline-flex px-4 py-2 text-sm font-medium">
          Manage grants
        </a>
      </DashboardPrimaryPanel>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardSecondaryPanel>
          <p className="section-kicker">Starter Access</p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
            Active Starter grants
          </h2>
          <div className="mt-5 space-y-3">
            {activeGrants.slice(0, 8).map((grant) => (
              <div key={grant.id} className="table-row-panel p-4">
                <p className="font-medium text-[var(--text-strong)]">{grant.email || "No email"}</p>
                <p className="mt-1 text-sm text-[var(--text-soft)]">
                  {grant.businessName || grant.businessId || "Account-wide"} | {grant.plan}
                </p>
              </div>
            ))}
            {activeGrants.length === 0 ? <div className="empty-state">No active Starter grants.</div> : null}
          </div>
        </DashboardSecondaryPanel>

        <DashboardSecondaryPanel>
          <p className="section-kicker">Plan Overrides</p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
            Active manual plan grants
          </h2>
          <div className="mt-5 space-y-3">
            {activePlanGrants.slice(0, 8).map((grant) => (
              <div key={grant.id} className="table-row-panel p-4">
                <p className="font-medium text-[var(--text-strong)]">
                  {grant.email || grant.userId || "No email"}
                </p>
                <p className="mt-1 text-sm text-[var(--text-soft)]">
                  {grant.scopeLabel} | {grant.grantedPlan}
                </p>
              </div>
            ))}
            {activePlanGrants.length === 0 ? <div className="empty-state">No active manual plan grants.</div> : null}
          </div>
        </DashboardSecondaryPanel>
      </div>
    </AdminPageContainer>
  );
}
