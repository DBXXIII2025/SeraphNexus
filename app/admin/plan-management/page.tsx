import { redirect } from "next/navigation";
import { getPlatformAdminSession } from "@/lib/platformAdmin";
import { getPlatformSettings } from "@/lib/platformSettings";
import { formatMonthlyPriceLabel } from "@/lib/platformBilling";
import { getVisiblePlatformPlans } from "@/lib/platformPlans";
import { formatPlatformFeeBpsLabel } from "@/lib/platformFees";
import {
  AdminPageContainer,
  DashboardPrimaryPanel,
  DashboardSecondaryPanel,
} from "@/components/admin/AdminLayoutSystem";

export default async function AdminPlanManagementPage() {
  const { isPlatformAdmin } = await getPlatformAdminSession();

  if (!isPlatformAdmin) {
    redirect("/admin");
  }

  const settings = await getPlatformSettings();
  const visiblePlans = getVisiblePlatformPlans(settings.plans);

  return (
    <AdminPageContainer className="text-[var(--text-main)]">
      <DashboardPrimaryPanel>
        <div className="section-header-copy">
          <p className="section-kicker">Platform</p>
          <h1 className="section-title">Plan management</h1>
          <p className="section-description">
            Review which plans are visible and how pricing and transaction fees are configured.
          </p>
        </div>
        <a href="/admin/platform" className="btn-primary mt-5 inline-flex px-4 py-2 text-sm font-medium">
          Edit plans
        </a>
      </DashboardPrimaryPanel>

      <DashboardSecondaryPanel>
        <div className="space-y-3">
          {visiblePlans.map((plan) => (
            <div key={plan.id} className="table-row-panel p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-[var(--text-strong)]">{plan.name}</p>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">{plan.subtitle}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-[var(--text-strong)]">
                    {formatMonthlyPriceLabel(plan.monthly_price_cents)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Fee {formatPlatformFeeBpsLabel(plan.transaction_fee_bps)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </DashboardSecondaryPanel>
    </AdminPageContainer>
  );
}
