import { companyMetadata } from "@/lib/companySeo";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { getManagedPricingSnapshot } from "@/lib/platformBilling";
import { getPlatformAdminSession } from "@/lib/platformAdmin";
import { normalizeBusinessPlan } from "@/lib/planConfig";
import { getVisiblePlatformPlans } from "@/lib/platformPlans";
import PricingClient from "./PricingClient";

export const metadata = companyMetadata("Platform plans and pricing","Explore SeraphNexus business workspace plans and pricing.","/pricing");

export default async function PricingPage() {
  const { user, isPlatformAdmin } = await getPlatformAdminSession();
  const business = await getActiveBusiness();
  const pricing = await getManagedPricingSnapshot();
  const visiblePlans = getVisiblePlatformPlans(pricing.settings.plans);

  return (
    <PricingClient
      activeBusinessId={business?.id || null}
      isLoggedIn={Boolean(user)}
      isPlatformAdmin={isPlatformAdmin}
      currentPlan={normalizeBusinessPlan(business?.plan)}
      pricingNote={pricing.settings.pricing_note}
      plans={visiblePlans}
    />
  );
}
