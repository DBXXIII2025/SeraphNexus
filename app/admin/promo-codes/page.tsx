import Link from "next/link";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { canCreatePromoCodes, getPlanDefinition } from "@/lib/planConfig";
import { createAdminTranslator } from "@/lib/adminI18n";
import {
  AdminPageContainer,
  DashboardPrimaryPanel,
} from "@/components/admin/AdminLayoutSystem";
import DiscountCodesManager from "@/app/admin/settings/DiscountCodesManager";

export default async function AdminPromoCodesPage() {
  const business = await getActiveBusiness();
  const t = createAdminTranslator(business?.language);

  if (!business) {
    return (
      <AdminPageContainer className="text-[var(--text-main)]">
        <DashboardPrimaryPanel>
          <div className="section-header-copy">
            <p className="section-kicker">Commerce</p>
            <h1 className="section-title">Promo codes</h1>
            <p className="section-description">Select a business before creating checkout discounts.</p>
          </div>
        </DashboardPrimaryPanel>
      </AdminPageContainer>
    );
  }

  const canUsePromoCodes = canCreatePromoCodes(business.plan);
  const plan = getPlanDefinition(business.plan);

  return (
    <AdminPageContainer className="text-[var(--text-main)]">
      <DashboardPrimaryPanel>
        <div className="section-header">
          <div className="section-header-copy">
            <p className="section-kicker">Commerce</p>
            <h1 className="section-title">Promo codes</h1>
            <p className="section-description">
              Create discount campaigns for this business without digging through broader settings.
            </p>
          </div>
          <Link href="/admin/payments" className="btn-secondary px-4 py-2 text-sm font-medium">
            Open payments
          </Link>
        </div>
      </DashboardPrimaryPanel>

      {canUsePromoCodes ? (
        <DiscountCodesManager businessId={business.id} businessType={business.business_type} />
      ) : (
        <DashboardPrimaryPanel>
          <div className="section-header-copy">
            <p className="section-kicker">Plan required</p>
            <h2 className="section-title">Promo codes are locked on {plan.label}</h2>
            <p className="section-description">
              Upgrade this workspace to Pro or Elite to create business-owned discount campaigns.
            </p>
          </div>
          <Link href="/admin/upgrade" className="btn-primary mt-5 inline-flex px-4 py-2 text-sm font-medium">
            {t("upgrade")}
          </Link>
        </DashboardPrimaryPanel>
      )}
    </AdminPageContainer>
  );
}
