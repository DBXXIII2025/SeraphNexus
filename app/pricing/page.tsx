import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { getManagedPricingSnapshot } from "@/lib/platformBilling";
import { getPlatformAdminSession } from "@/lib/platformAdmin";
import { normalizeBusinessPlan } from "@/lib/planConfig";
import PricingClient from "./PricingClient";

export const metadata = {
  title: "Pricing | Seraph Nexus",
  description: "Choose a Seraph Nexus plan for the active business workspace.",
};

export default async function PricingPage() {
  const { user, isPlatformAdmin } = await getPlatformAdminSession();
  const business = await getActiveBusiness();
  const pricing = await getManagedPricingSnapshot();

  return (
    <PricingClient
      activeBusinessId={business?.id || null}
      isLoggedIn={Boolean(user)}
      isPlatformAdmin={isPlatformAdmin}
      currentPlan={normalizeBusinessPlan(business?.plan)}
      pricing={{
        pro: { label: pricing.pro.monthlyPriceLabel, active: pricing.pro.active },
        elite: { label: pricing.elite.monthlyPriceLabel, active: pricing.elite.active },
      }}
      planCopy={{
        pro: {
          name: pricing.settings.pro_plan_name,
          subtitle: pricing.settings.pro_plan_subtitle,
          features: pricing.settings.pro_plan_features,
          badge: pricing.settings.pro_plan_badge,
          cta: pricing.settings.pro_plan_cta,
        },
        elite: {
          name: pricing.settings.elite_plan_name,
          subtitle: pricing.settings.elite_plan_subtitle,
          features: pricing.settings.elite_plan_features,
          badge: pricing.settings.elite_plan_badge,
          cta: pricing.settings.elite_plan_cta,
        },
      }}
    />
  );
}
