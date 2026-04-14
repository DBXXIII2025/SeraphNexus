import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { getManagedPricingSnapshot } from "@/lib/platformBilling";
import { getPlanDefinition, getPlatformFeeLabel } from "@/lib/planConfig";
import { createAdminTranslator } from "@/lib/adminI18n";
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
    return <div className="text-white">{createAdminTranslator(null)("noActiveBusiness")}</div>;
  }

  const t = createAdminTranslator(business.language);
  const plan = getPlanDefinition(business.plan);
  const pricing = await getManagedPricingSnapshot();
  const currentPriceLabel =
    plan.tier === "pro"
      ? pricing.pro.monthlyPriceLabel
      : plan.tier === "elite"
        ? pricing.elite.monthlyPriceLabel
        : plan.monthlyPriceLabel;

  return (
    <div className="space-y-6 text-white">
      <div>
        <h1 className="text-2xl font-semibold">{t("upgrade")}</h1>
        <p className="text-sm text-gray-400">
          Manage plan access and transaction fees for {business.name}.
        </p>
      </div>

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

      <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
              Current Plan
            </p>
            <h2 className="mt-2 text-2xl font-semibold">{plan.label}</h2>
            <p className="mt-2 text-sm text-gray-400">
              Billing: {currentPriceLabel}
            </p>
            <p className="mt-2 text-sm text-gray-400">
              Current platform fee: {getPlatformFeeLabel(business.plan)} per
              successful transaction.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-gray-300">
            Businesses on lower-fee plans keep more of each Stripe Connect payout.
          </div>
        </div>
      </div>

      <UpgradeClient
        businessId={business.id}
        currentPlan={plan.tier}
        pricing={{
          pro: {
            label: pricing.pro.monthlyPriceLabel,
            active: pricing.pro.active,
          },
          elite: {
            label: pricing.elite.monthlyPriceLabel,
            active: pricing.elite.active,
          },
        }}
      />
    </div>
  );
}
