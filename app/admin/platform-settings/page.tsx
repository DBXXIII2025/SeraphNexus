import { redirect } from "next/navigation";
import { getPlatformAdminSession } from "@/lib/platformAdmin";
import { getPlatformSettings } from "@/lib/platformSettings";
import { getPlatformStripeEnvironmentSummary } from "@/lib/platformBilling";
import {
  AdminPageContainer,
  DashboardPrimaryPanel,
  DashboardSecondaryPanel,
} from "@/components/admin/AdminLayoutSystem";

export default async function AdminPlatformSettingsPage() {
  const { isPlatformAdmin } = await getPlatformAdminSession();

  if (!isPlatformAdmin) {
    redirect("/admin");
  }

  const settings = await getPlatformSettings();
  const stripeEnvironment = getPlatformStripeEnvironmentSummary();

  return (
    <AdminPageContainer className="text-[var(--text-main)]">
      <DashboardPrimaryPanel>
        <div className="section-header-copy">
          <p className="section-kicker">Platform</p>
          <h1 className="section-title">Platform settings</h1>
          <p className="section-description">
            Brand, support, and platform-wide Stripe configuration for Seraph Nexus.
          </p>
        </div>
        <a href="/admin/platform" className="btn-primary mt-5 inline-flex px-4 py-2 text-sm font-medium">
          Open full platform control
        </a>
      </DashboardPrimaryPanel>

      <DashboardSecondaryPanel>
        <div className="space-y-3">
          <div className="table-row-panel flex items-center justify-between px-4 py-3">
            <span className="text-sm text-[var(--text-soft)]">Platform name</span>
            <span className="text-sm font-medium text-[var(--text-strong)]">{settings.platform_name}</span>
          </div>
          <div className="table-row-panel flex items-center justify-between px-4 py-3">
            <span className="text-sm text-[var(--text-soft)]">Support email</span>
            <span className="text-sm font-medium text-[var(--text-strong)]">{settings.support_email}</span>
          </div>
          <div className="table-row-panel flex items-center justify-between px-4 py-3">
            <span className="text-sm text-[var(--text-soft)]">Stripe mode</span>
            <span className="text-sm font-medium text-[var(--text-strong)]">
              {stripeEnvironment.configured
                ? stripeEnvironment.mode === "live"
                  ? "Live"
                  : "Test"
                : "Not configured"}
            </span>
          </div>
        </div>
      </DashboardSecondaryPanel>
    </AdminPageContainer>
  );
}
