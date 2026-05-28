import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { getManagedPricingSnapshot } from "@/lib/platformBilling";
import { getPlanDefinition, getPlatformFeeLabel } from "@/lib/planConfig";
import { getConfiguredPlatformFee } from "@/lib/platformFees";
import { getVisiblePlatformPlans } from "@/lib/platformPlans";
import { AdminPageContainer, DashboardPrimaryPanel } from "@/components/admin/AdminLayoutSystem";
import UpgradeClient from "./UpgradeClient";

type UpgradePageProps = {
  searchParams?: Promise<{
    billing?: string;
  }>;
};

export default async function AdminUpgradePage({
  searchParams,
}: UpgradePageProps) {
  const params = searchParams ? await searchParams : undefined;
  const business = await getActiveBusiness();

  if (!business) {
    return <div className="text-[var(--text-main)]">{createAdminTranslator(null)("noActiveBusiness")}</div>;
  }

  const plan = getPlanDefinition(business.plan);
  const platformFee = await getConfiguredPlatformFee(business.plan);
  const pricing = await getManagedPricingSnapshot();
  const visiblePlans = getVisiblePlatformPlans(pricing.settings.plans);
  const currentPriceLabel =
    plan.tier === "pro"
      ? pricing.pro.monthlyPriceLabel
      : plan.tier === "elite"
        ? pricing.elite.monthlyPriceLabel
        : plan.monthlyPriceLabel;

  return (
    <AdminPageContainer className="space-y-6 text-[var(--text-main)]">
      <DashboardPrimaryPanel>
        <div className="section-header-copy">
          <p className="section-kicker">Settings</p>
          <h1 className="section-title">Billing and plan</h1>
          <p className="section-description">
            Review workspace plan access, monthly pricing, and the Stripe Connect fee level tied to
            this business.
          </p>
        </div>
      </DashboardPrimaryPanel>

      {params?.billing === "success" ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          Billing checkout completed. Your plan will refresh as soon as Stripe
          confirms the subscription.
        </div>
      ) : null}

      {params?.billing === "canceled" ? (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
          Billing checkout was canceled. Your current plan has not changed.
        </div>
      ) : null}

      <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
              Current Plan
            </p>
            <h2 className="mt-2 text-2xl font-semibold">{plan.label}</h2>
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              Billing: {currentPriceLabel}
            </p>
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              Current platform fee: {platformFee.label || getPlatformFeeLabel(business.plan)} per
              successful transaction.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-soft)]">
            Businesses on lower-fee plans keep more of each Stripe Connect payout.
          </div>
        </div>
      </div>

      <UpgradeClient
        businessId={business.id}
        currentPlan={plan.tier}
        pricingNote={pricing.settings.pricing_note}
        plans={visiblePlans}
      />
    </AdminPageContainer>
  );
}
