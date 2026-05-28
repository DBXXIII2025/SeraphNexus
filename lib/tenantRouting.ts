import { getBusinessReadinessState } from "@/lib/businessReadiness";

type TenantBusiness = {
  id: string;
  owner_id: string | null;
  name: string | null;
  slug: string | null;
  description?: string | null;
  business_type: string | null;
  stripe_account_id?: string | null;
  stripe_onboarding_complete?: boolean | null;
  stripe_charges_enabled?: boolean | null;
  stripe_payouts_enabled?: boolean | null;
  is_published?: boolean | null;
};

export async function getTenantAdminHomeRoute(args: {
  business: TenantBusiness;
  userId: string;
}) {
  const recovery = await getTenantRecoveryState(args);
  return recovery.href;
}

export async function getTenantRecoveryState(args: {
  business: TenantBusiness;
  userId: string;
}) {
  const readiness = await getBusinessReadinessState({
    business: args.business,
    userId: args.userId,
  });

  if (!readiness.canPublishLive) {
    const currentStep = readiness.onboarding.currentStep;

    if (!currentStep) {
      return {
        readiness,
        href: readiness.onboarding.resumeHref,
        label: "Resume onboarding",
        reason: "Incomplete setup still needs attention.",
      };
    }

    if (currentStep.kind === "offerings") {
      return {
        readiness,
        href: currentStep.href,
        label: currentStep.label,
        reason: "The next useful step is creating the first real record for this business.",
      };
    }

    return {
      readiness,
      href: readiness.onboarding.resumeHref,
      label: currentStep.label,
      reason: "Resume onboarding from the next unfinished setup step.",
    };
  }

  return {
    readiness,
    href: "/admin/dashboard",
    label: "Dashboard",
    reason: readiness.isLive
      ? "This business is already live and ready for its command center."
      : "Setup is complete. Move into the dashboard command center for this business.",
  };
}
