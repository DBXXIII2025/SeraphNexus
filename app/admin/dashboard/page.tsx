import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { buildDashboardData } from "@/lib/adminDashboard";
import { getBusinessReadinessFromOnboarding } from "@/lib/businessReadiness";
import { getBusinessOnboardingState } from "@/lib/onboarding";
import { getUpgradeTriggers } from "@/lib/planEnforcement";
import { loadBusinessUsageSnapshot } from "@/lib/planUsageServer";
import { getPlatformAdminSession } from "@/lib/platformAdmin";
import PlatformOwnerDashboard from "./PlatformOwnerDashboard";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { user, isPlatformAdmin } = await getPlatformAdminSession();

  if (isPlatformAdmin && user?.id) {
    return <PlatformOwnerDashboard ownerUserId={user.id} />;
  }

  const supabase = await createClient();
  const business = await getActiveBusiness();

  if (!business) {
    return <div className="p-6 text-white">No business found.</div>;
  }

  const dashboard = await buildDashboardData({
    supabase,
    business,
  });

  const onboarding = user?.id
    ? await getBusinessOnboardingState({
        business,
        userId: user.id,
      })
    : null;
  const readiness = onboarding
    ? getBusinessReadinessFromOnboarding({
        onboarding,
        isPublished: business.is_published === true,
      })
    : null;
  const usage = await loadBusinessUsageSnapshot(business.id);
  const upgradeTriggers = getUpgradeTriggers({
    plan: business.plan,
    usage,
  });

  return (
    <DashboardClient
      business={business}
      dashboard={dashboard}
      onboarding={onboarding}
      readiness={readiness}
      upgradeTriggers={upgradeTriggers}
    />
  );
}
