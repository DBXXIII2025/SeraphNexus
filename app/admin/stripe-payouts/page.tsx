import { redirect } from "next/navigation";
import ConnectStripeButton from "@/components/ConnectStripeButton";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { getPaymentReadiness } from "@/lib/paymentReadiness";
import { canAccessPlanFeature } from "@/lib/planConfig";
import { getPlatformAdminSession } from "@/lib/platformAdmin";
import {
  AdminPageContainer,
  DashboardPrimaryPanel,
  DashboardSecondaryPanel,
} from "@/components/admin/AdminLayoutSystem";

function getStripeConnectionState(input: {
  stripe_account_id?: string | null;
  stripe_onboarding_complete?: boolean | null;
  stripe_charges_enabled?: boolean | null;
  stripe_payouts_enabled?: boolean | null;
}) {
  if (!input.stripe_account_id) {
    return "Not connected";
  }

  if (!input.stripe_onboarding_complete) {
    return "Onboarding incomplete";
  }

  if (input.stripe_charges_enabled && input.stripe_payouts_enabled) {
    return "Charges and payouts enabled";
  }

  if (input.stripe_charges_enabled) {
    return "Charges enabled";
  }

  if (input.stripe_payouts_enabled) {
    return "Payouts enabled";
  }

  return "Connected but restricted";
}

function StatusRow({
  label,
  value,
}: {
  label: string;
  value: string | boolean;
}) {
  return (
    <div className="table-row-panel flex items-center justify-between px-4 py-3">
      <span className="text-sm text-[var(--text-soft)]">{label}</span>
      <span className="text-sm font-medium text-[var(--text-strong)]">
        {typeof value === "boolean" ? (value ? "Yes" : "No") : value}
      </span>
    </div>
  );
}

export default async function AdminStripePayoutsPage() {
  const { isPlatformAdmin } = await getPlatformAdminSession();

  if (isPlatformAdmin) {
    redirect("/admin/platform-settings");
  }

  const business = await getActiveBusiness();

  if (!business) {
    return (
      <AdminPageContainer className="text-[var(--text-main)]">
        <DashboardPrimaryPanel>
          <h1 className="section-title">Stripe and payouts</h1>
          <p className="section-description">Select a business before managing Stripe payouts.</p>
        </DashboardPrimaryPanel>
      </AdminPageContainer>
    );
  }

  const paymentReadiness = getPaymentReadiness(business);
  const canUsePayments = canAccessPlanFeature(business.plan, "stripe_payments");

  return (
    <AdminPageContainer className="text-[var(--text-main)]">
      <DashboardPrimaryPanel>
        <div className="section-header-copy">
          <p className="section-kicker">Settings</p>
          <h1 className="section-title">Stripe and payouts</h1>
          <p className="section-description">
            Review Stripe Connect status, payout readiness, and the next action for this business.
          </p>
        </div>
      </DashboardPrimaryPanel>

      <DashboardSecondaryPanel>
        <div className="space-y-3">
          <StatusRow label="Connection state" value={getStripeConnectionState(business)} />
          <StatusRow label="Stripe account ID" value={business.stripe_account_id || "Not connected"} />
          <StatusRow label="Onboarding complete" value={Boolean(business.stripe_onboarding_complete)} />
          <StatusRow label="Charges enabled" value={Boolean(business.stripe_charges_enabled)} />
          <StatusRow label="Payouts enabled" value={Boolean(business.stripe_payouts_enabled)} />
          <StatusRow label="Payment readiness" value={paymentReadiness.label} />
        </div>

        <div className="mt-5 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
          {paymentReadiness.summary}
        </div>

        {!canUsePayments ? (
          <div className="mt-5 rounded-lg border border-[var(--accent-border)] bg-[var(--accent-muted)] px-4 py-3 text-sm text-[var(--accent-soft)]">
            Stripe payments are available on Starter Access and above.
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          {canUsePayments && !business.stripe_account_id ? (
            <ConnectStripeButton
              businessId={business.id}
              label="Connect Stripe"
              loadingLabel="Redirecting to Stripe setup..."
              className="w-full sm:w-auto"
            />
          ) : null}
          {canUsePayments &&
          business.stripe_account_id &&
          paymentReadiness.status !== "payment_ready" ? (
            <ConnectStripeButton
              businessId={business.id}
              label="Continue Stripe setup"
              loadingLabel="Redirecting to Stripe setup..."
              className="w-full sm:w-auto"
            />
          ) : null}
          {canUsePayments && business.stripe_account_id ? (
            <ConnectStripeButton
              businessId={business.id}
              endpoint="/api/stripe/manage"
              label="Manage Stripe account"
              loadingLabel="Opening Stripe account..."
              className="w-full sm:w-auto"
            />
          ) : null}
          {canUsePayments && business.stripe_account_id ? (
            <a
              href={`/api/stripe/return?businessId=${encodeURIComponent(business.id)}`}
              className="btn-secondary px-4 py-2 text-sm font-medium"
            >
              Refresh payment status
            </a>
          ) : null}
        </div>
      </DashboardSecondaryPanel>
    </AdminPageContainer>
  );
}
