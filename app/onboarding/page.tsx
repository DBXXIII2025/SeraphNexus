import { redirect } from "next/navigation";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { getBusinessOnboardingState } from "@/lib/onboarding";
import { getPlatformAdminSession } from "@/lib/platformAdmin";
import { getTenantAdminHomeRoute } from "@/lib/tenantRouting";
import CreateBusinessPage from "./components/CreateBusinessPage";
import OnboardingChecklistClient from "./components/OnboardingChecklistClient";

type OnboardingPageProps = {
  searchParams?: Promise<{
    businessId?: string;
  }>;
};

export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const requestedBusinessId = String(params?.businessId || "").trim() || undefined;
  const { user, isPlatformAdmin } = await getPlatformAdminSession();

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(
        requestedBusinessId
          ? `/onboarding?businessId=${encodeURIComponent(requestedBusinessId)}`
          : "/onboarding"
      )}`
    );
  }

  if (isPlatformAdmin) {
    redirect("/admin/dashboard");
  }

  const business = await getActiveBusiness(requestedBusinessId);

  if (!business) {
    return <CreateBusinessPage redirectPath="/onboarding" />;
  }

  const onboarding = await getBusinessOnboardingState({
    business,
    userId: user.id,
  });

  if (onboarding.isComplete) {
    const route = await getTenantAdminHomeRoute({
      business,
      userId: user.id,
    });
    redirect(route);
  }

  return <OnboardingChecklistClient onboarding={onboarding} />;
}
