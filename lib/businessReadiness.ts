import {
  getBusinessOnboardingState,
  type BusinessOnboardingState,
  type BusinessOnboardingStep,
} from "@/lib/onboarding";

export type BusinessReadinessStatus =
  | "not_started"
  | "incomplete_setup"
  | "nearly_ready"
  | "ready_to_publish"
  | "live";

export type BusinessReadinessBlocker = {
  id: string;
  label: string;
  description: string;
  href: string;
  kind: BusinessOnboardingStep["kind"];
};

export type BusinessReadinessState = {
  status: BusinessReadinessStatus;
  label: string;
  summary: string;
  blockers: BusinessReadinessBlocker[];
  onboarding: BusinessOnboardingState;
  canPublishLive: boolean;
  isLive: boolean;
  isPublished: boolean;
  nextActionHref: string;
  nextActionLabel: string;
};

function getStatusLabel(status: BusinessReadinessStatus) {
  switch (status) {
    case "live":
      return "Live";
    case "ready_to_publish":
      return "Ready to publish";
    case "nearly_ready":
      return "Nearly ready";
    case "incomplete_setup":
      return "Incomplete setup";
    default:
      return "Not started";
  }
}

function getStatusSummary(args: {
  status: BusinessReadinessStatus;
  blockers: BusinessReadinessBlocker[];
}) {
  if (args.status === "live") {
    return "This business is live and all required readiness checks are complete.";
  }

  if (args.status === "ready_to_publish") {
    return "This business has completed its required setup and can be published safely.";
  }

  if (args.status === "nearly_ready") {
    return `One blocker remains before this business can go live: ${
      args.blockers[0]?.label.toLowerCase() || "complete setup"
    }.`;
  }

  if (args.status === "incomplete_setup") {
    return `${args.blockers.length} setup blockers still need attention before this business can go live.`;
  }

  return "This business has not finished enough setup to be treated as publish-ready yet.";
}

export function getBusinessReadinessFromOnboarding(args: {
  onboarding: BusinessOnboardingState;
  isPublished: boolean;
}): BusinessReadinessState {
  const blockers = args.onboarding.steps
    .filter((step) => !step.completed)
    .map((step) => ({
      id: step.id,
      label: step.label,
      description: step.description,
      href: step.href,
      kind: step.kind,
    }));

  const canPublishLive = args.onboarding.isComplete;
  const isLive = canPublishLive && args.isPublished;

  let status: BusinessReadinessStatus = "not_started";
  if (isLive) {
    status = "live";
  } else if (canPublishLive) {
    status = "ready_to_publish";
  } else if (args.onboarding.completedCount <= 1) {
    status = "not_started";
  } else if (blockers.length === 1) {
    status = "nearly_ready";
  } else {
    status = "incomplete_setup";
  }

  const nextStep = args.onboarding.currentStep;

  return {
    status,
    label: getStatusLabel(status),
    summary: getStatusSummary({
      status,
      blockers,
    }),
    blockers,
    onboarding: args.onboarding,
    canPublishLive,
    isLive,
    isPublished: args.isPublished,
    nextActionHref:
      canPublishLive && !args.isPublished
        ? "/admin/settings"
        : nextStep?.href || args.onboarding.resumeHref,
    nextActionLabel:
      canPublishLive && !args.isPublished
        ? "Review publish settings"
        : nextStep
          ? `Complete ${nextStep.label}`
          : "Open onboarding",
  };
}

export async function getBusinessReadinessState(args: {
  business: Parameters<typeof getBusinessOnboardingState>[0]["business"] & {
    is_published?: boolean | null;
  };
  userId: string;
}) {
  const onboarding = await getBusinessOnboardingState({
    business: args.business,
    userId: args.userId,
  });

  return getBusinessReadinessFromOnboarding({
    onboarding,
    isPublished: args.business.is_published === true,
  });
}
