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
    />
  );
}
