export type PaymentReadinessInput = {
  stripe_account_id?: string | null;
  stripe_onboarding_complete?: boolean | null;
  stripe_charges_enabled?: boolean | null;
  stripe_payouts_enabled?: boolean | null;
};

export type PaymentReadinessStatus =
  | "not_started"
  | "onboarding_in_progress"
  | "connected_incomplete"
  | "charges_disabled"
  | "payouts_disabled"
  | "payment_ready";

export type PaymentReadiness = {
  status: PaymentReadinessStatus;
  label: string;
  summary: string;
  actionLabel: string;
  canAcceptPayments: boolean;
  canPublishLive: boolean;
};

function isTrue(value: unknown) {
  return value === true;
}

export function getPaymentReadiness(
  input: PaymentReadinessInput
): PaymentReadiness {
  const hasAccount = Boolean(input.stripe_account_id);
  const onboardingComplete = isTrue(input.stripe_onboarding_complete);
  const chargesEnabled = isTrue(input.stripe_charges_enabled);
  const payoutsEnabled = isTrue(input.stripe_payouts_enabled);

  if (!hasAccount) {
    return {
      status: "not_started",
      label: "Not started",
      summary: "Stripe Connect has not been started for this business yet.",
      actionLabel: "Connect Stripe",
      canAcceptPayments: false,
      canPublishLive: false,
    };
  }

  if (!onboardingComplete) {
    return {
      status: "onboarding_in_progress",
      label: "Onboarding in progress",
      summary:
        "Stripe is connected, but onboarding has not been completed yet. Resume Stripe onboarding to finish setup.",
      actionLabel: "Continue Stripe onboarding",
      canAcceptPayments: false,
      canPublishLive: false,
    };
  }

  if (!chargesEnabled && !payoutsEnabled) {
    return {
      status: "connected_incomplete",
      label: "Connected but incomplete",
      summary:
        "Stripe account details were submitted, but charges and payouts are still disabled.",
      actionLabel: "Review payment readiness",
      canAcceptPayments: false,
      canPublishLive: false,
    };
  }

  if (!chargesEnabled) {
    return {
      status: "charges_disabled",
      label: "Charges disabled",
      summary:
        "Stripe onboarding is partially complete, but charges are still disabled. This business cannot take live payments yet.",
      actionLabel: "Review payment readiness",
      canAcceptPayments: false,
      canPublishLive: false,
    };
  }

  if (!payoutsEnabled) {
    return {
      status: "payouts_disabled",
      label: "Payouts disabled",
      summary:
        "This business can charge customers, but payouts are still disabled. Review Stripe to finish payment setup.",
      actionLabel: "Review payment readiness",
      canAcceptPayments: true,
      canPublishLive: false,
    };
  }

  return {
    status: "payment_ready",
    label: "Payment ready",
    summary:
      "Stripe is fully connected for live payments. Charges and payouts are enabled.",
    actionLabel: "Refresh payment status",
    canAcceptPayments: true,
    canPublishLive: true,
  };
}
