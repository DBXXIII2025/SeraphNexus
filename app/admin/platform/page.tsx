import Link from "next/link";
import { getConfiguredAppUrl } from "@/lib/appUrl";
import {
  formatMonthlyPriceLabel,
  getManagedPlanPricingState,
  getPlatformStripeEnvironmentSummary,
} from "@/lib/platformBilling";
import { getActiveAccessGrantList } from "@/lib/accessGrantAdmin";
import {
  getActivePlanGrantList,
  getPlanGrantHistoryList,
} from "@/lib/planGrantAdmin";
import { getPlatformAdminData } from "@/lib/platformAdminData";
import { getPlatformAdminSession } from "@/lib/platformAdmin";
import { getPlatformSettings } from "@/lib/platformSettings";
import { formatPlatformFeeBpsLabel } from "@/lib/platformFees";
import {
  MAX_PLATFORM_LOGO_BYTES,
  resolvePlatformLogoUrl,
  resolvePlatformName,
} from "@/lib/platformBranding";
import { inspectPlatformLogoAsset } from "@/lib/platformLogoAsset";
import { PLAN_DEFINITIONS, type PlanFeature } from "@/lib/planConfig";
import { getVisiblePlatformPlans } from "@/lib/platformPlans";
import {
  getPlatformIncomeAudit,
  getPlatformOwnerBusinessAudits,
} from "@/lib/platformOwnerCleanup";
import PlatformBrandingPanel from "./PlatformBrandingPanel";
import PlatformPlansEditor from "./PlatformPlansEditor";
import {
  AdminPageContainer,
  DashboardGrid,
  DashboardPrimaryPanel,
  DashboardSecondaryPanel,
  MetricCard,
} from "@/components/admin/AdminLayoutSystem";

type PlatformPageProps = {
  searchParams?: Promise<{
    success?: string;
    error?: string;
  }>;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "No signal";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function getStatusCopy(
  type: "success" | "error",
  value: string | undefined
) {
  if (!value) {
    return null;
  }

  if (type === "success") {
    if (value === "trial-granted") {
      return "Trial access granted to the existing account.";
    }

    if (value === "invite-created") {
      return "Email-bound private trial invite created.";
    }

    if (value === "grant-revoked") {
      return "Access grant revoked.";
    }

    if (value === "plan-grant-created") {
      return "Manual plan grant created.";
    }

    if (value === "plan-grant-revoked") {
      return "Manual plan grant revoked.";
    }

    if (value === "platform-settings-saved") {
      return "Platform settings and managed billing were saved.";
    }

    if (value === "platform-logo-updated") {
      return "Platform logo saved. Render status is verified in the branding panel below.";
    }

    if (value === "platform-logo-cleared") {
      return "Platform logo cleared. Headers now use the fallback platform mark.";
    }

    if (value === "broadcast-sent") {
      return "Platform notification broadcast sent to business accounts.";
    }
  }

  if (value === "forbidden") {
    return "Platform admin access is required.";
  }

  if (value === "grant-email-required") {
    return "An existing user email is required to grant trial access.";
  }

  if (value === "grant-user-not-found") {
    return "No existing account matched that email address.";
  }

  if (value === "plan-grant-email-required") {
    return "An existing user email is required to grant a manual plan.";
  }

  if (value === "plan-grant-user-not-found") {
    return "No existing account matched that email address for the manual grant.";
  }

  if (value === "granted-plan-required") {
    return "Select Pro or Elite for the manual grant.";
  }

  if (value === "grant-type-required") {
    return "Select whether the grant is temporary or permanent.";
  }

  if (value === "temporary-expiry-required") {
    return "Temporary manual grants require a duration preset or a custom expiration date.";
  }

  if (value === "invalid-custom-expiry") {
    return "Custom expiration must be a valid future date.";
  }

  if (value === "permanent-expiry-not-allowed") {
    return "Permanent grants cannot include an expiration preset or custom expiry.";
  }

  if (value === "plan-grant-business-not-found") {
    return "The selected business id could not be found.";
  }

  if (value === "plan-grant-business-owner-mismatch") {
    return "That business is not owned by the selected account, so the grant would never apply.";
  }

  if (value === "plan-grant-failed") {
    return "Manual plan grant could not be created.";
  }

  if (value === "plan-grant-id-required") {
    return "A manual grant id is required to revoke access.";
  }

  if (value === "plan-grant-revoke-failed") {
    return "Manual plan grant revocation failed.";
  }

  if (value === "unknown-plan-grant-action") {
    return "Unknown manual plan grant action.";
  }

  if (value === "grant-failed") {
    return "Trial access could not be granted.";
  }

  if (value === "invite-email-required") {
    return "An email address is required to create an invite.";
  }

  if (value === "invite-create-failed") {
    return "Invite creation failed.";
  }

  if (value === "grant-id-required") {
    return "A grant id is required to revoke access.";
  }

  if (value === "revoke-failed") {
    return "Grant revocation failed.";
  }

  if (value === "unknown-action") {
    return "Unknown access-grant action.";
  }

  if (value === "platform-stripe-not-configured") {
    return "Platform Stripe is not configured yet. Add the Stripe secret key before opening Stripe management.";
  }

  if (value === "platform-settings-unavailable") {
    return "Platform settings storage is unavailable. Apply the platform settings migration first.";
  }

  if (value === "platform-settings-save-failed") {
    return "Platform settings could not be saved.";
  }

  if (value === "platform-logo-required") {
    return "Choose a logo file before uploading.";
  }

  if (value === "platform-logo-type-invalid") {
    return "Only JPG, PNG, WEBP, and SVG platform logos are allowed.";
  }

  if (value === "platform-logo-too-large") {
    return `Platform logos must be ${Math.round(MAX_PLATFORM_LOGO_BYTES / 1024 / 1024)} MB or smaller.`;
  }

  if (value === "platform-logo-upload-failed") {
    return "The logo file could not be uploaded.";
  }

  if (value === "broadcast-title-required") {
    return "A broadcast title is required.";
  }

  if (value === "broadcast-body-required") {
    return "A broadcast message is required.";
  }

  if (value === "broadcast-duplicate") {
    return "An identical platform broadcast was already sent recently.";
  }

  if (value === "broadcast-send-failed") {
    return "Platform broadcast delivery failed.";
  }

  if (value === "broadcast-schema-missing") {
    return "Notifications storage is unavailable. Apply the business notifications migration first.";
  }

  if (value === "platform-branding-settings-unavailable") {
    return "Platform branding settings could not be loaded.";
  }

  if (value === "platform-branding-migration-required") {
    return "Platform branding data is not ready. Apply the platform branding migration first.";
  }

  if (value === "platform-branding-storage-unavailable") {
    return "Platform branding storage bucket is unavailable. Check the platform-branding bucket setup.";
  }

  if (value === "platform-branding-save-failed" || value === "platform-logo-update-failed") {
    return "Platform branding could not be updated.";
  }

  return "The access-grant action could not be completed.";
}

const ELITE_FEATURE_STATUS: Array<{
  feature: PlanFeature;
  label: string;
  enforcement: string;
}> = [
  {
    feature: "standard_customization",
    label: "Standard customization",
    enforcement: "Logo and profile customization routes are plan-gated server-side.",
  },
  {
    feature: "advanced_analytics",
    label: "Advanced analytics",
    enforcement: "Analytics page and performance API require the analytics plan gates.",
  },
  {
    feature: "automation",
    label: "Automation and reminders",
    enforcement: "Reminder cron sends only for businesses with the automation feature.",
  },
  {
    feature: "priority_listing",
    label: "Priority explore boost",
    enforcement: "Explore ranking adds deterministic boost for Elite effective plans.",
  },
  {
    feature: "team_roles",
    label: "Team and staff roles",
    enforcement: "Staff roster writes are Elite-gated and owner-scoped.",
  },
  {
    feature: "advanced_customization",
    label: "Advanced customization",
    enforcement: "Advanced customization controls are Elite-gated.",
  },
  {
    feature: "advanced_messaging",
    label: "Advanced messaging tools",
    enforcement: "Admin inbox receives advanced tool flag only for Elite.",
  },
  {
    feature: "advanced_payments",
    label: "Advanced payment features",
    enforcement: "Payment audit metadata and dynamic fee routing are server-side.",
  },
  {
    feature: "lead_capture",
    label: "Lead capture",
    enforcement: "Lead dashboard and ingestion are plan-gated.",
  },
  {
    feature: "branding_customization",
    label: "Brand customization",
    enforcement: "Branding controls are tied to customization plan gates.",
  },
];

export default async function PlatformPage({
  searchParams,
}: PlatformPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const settings = await getPlatformSettings();
  const { user, isPlatformAdmin } = await getPlatformAdminSession();

  if (!isPlatformAdmin) {
    return (
      <AdminPageContainer className="text-[var(--text-main)]">
        <DashboardPrimaryPanel>
          <div className="section-header-copy">
            <p className="section-kicker">Platform</p>
            <h1 className="section-title">Platform settings</h1>
            <p className="section-description">
              Editable SaaS copy and support information used across the app.
            </p>
          </div>
        </DashboardPrimaryPanel>

        <DashboardSecondaryPanel className="border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
          Platform editing is restricted to accounts whose profile is marked as
          a platform admin.
        </DashboardSecondaryPanel>

        <form
          action="/api/admin/platform"
          method="POST"
          className="dashboard-primary-panel space-y-5 p-6"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-[var(--text-soft)]">
              <span className="form-label">Platform name</span>
              <input
                name="platform_name"
                defaultValue={settings.platform_name}
                disabled
                className="input-field disabled:opacity-60"
              />
            </label>
            <label className="text-sm text-[var(--text-soft)]">
              <span className="form-label">Support email</span>
              <input
                name="support_email"
                defaultValue={settings.support_email}
                disabled
                className="input-field disabled:opacity-60"
              />
            </label>
          </div>
          <label className="text-sm text-[var(--text-soft)]">
            <span className="form-label">Headline</span>
            <input
              name="marketing_headline"
              defaultValue={settings.marketing_headline}
              disabled
              className="input-field disabled:opacity-60"
            />
          </label>
          <label className="text-sm text-[var(--text-soft)]">
            <span className="form-label">Subheadline</span>
            <textarea
              name="marketing_subheadline"
              defaultValue={settings.marketing_subheadline}
              disabled
              className="input-field min-h-[110px] disabled:opacity-60"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-[var(--text-soft)]">
              <span className="form-label">Support phone</span>
              <input
                name="support_phone"
                defaultValue={settings.support_phone}
                disabled
                className="input-field disabled:opacity-60"
              />
            </label>
            <label className="text-sm text-[var(--text-soft)]">
              <span className="form-label">Pricing note</span>
              <input
                name="pricing_note"
                defaultValue={settings.pricing_note}
                disabled
                className="input-field disabled:opacity-60"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            Save Platform Settings
          </button>
        </form>
      </AdminPageContainer>
    );
  }

  const [platformData, , activeGrants, activePlanGrants, planGrantHistory, proPricing, elitePricing] = await Promise.all([
    getPlatformAdminData(),
    getPlatformOwnerBusinessAudits(user!.id),
    getActiveAccessGrantList(),
    getActivePlanGrantList(),
    getPlanGrantHistoryList(),
    getManagedPlanPricingState("pro"),
    getManagedPlanPricingState("elite"),
  ]);
  const incomeAudit = getPlatformIncomeAudit();
  const grantCreateLinkBase = getConfiguredAppUrl() || "";
  const successMessage = getStatusCopy("success", params?.success);
  const errorMessage = getStatusCopy("error", params?.error);
  const stripeEnvironment = getPlatformStripeEnvironmentSummary();
  const platformSiteName = resolvePlatformName(settings);
  const platformLogoUrl = resolvePlatformLogoUrl(settings);
  const platformLogoAsset = await inspectPlatformLogoAsset(platformLogoUrl);
  const visiblePlans = getVisiblePlatformPlans(settings.plans);

  console.info("[platform-branding] platform page branding payload", {
    platformName: platformSiteName,
    rawLogoUrl: settings.logo_url,
    resolvedLogoUrl: platformLogoUrl,
    assetReachable: platformLogoAsset.reachable,
    assetStatusCode: platformLogoAsset.statusCode,
    assetContentType: platformLogoAsset.contentType,
    assetReason: platformLogoAsset.reason,
  });

  return (
    <AdminPageContainer className="text-[var(--text-main)]">
      <DashboardPrimaryPanel>
        <div className="section-header-copy">
          <p className="section-kicker">Platform Control</p>
          <h1 className="section-title">
            Platform-owner controls and business health
          </h1>
          <p className="section-description">
            Platform-owner controls, business health, support oversight, and
            dependency-aware cleanup reporting for businesses owned by this
            account.
          </p>
        </div>
      </DashboardPrimaryPanel>

      <DashboardGrid className="md:grid-cols-2 xl:grid-cols-3">
        {platformData.metrics.map((metric) => (
          <MetricCard key={metric.label}>
            <p className="section-kicker">{metric.label}</p>
            <p className="mt-3 text-3xl font-semibold text-[var(--text-strong)]">
              {metric.value}
            </p>
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              {metric.detail}
            </p>
          </MetricCard>
        ))}
      </DashboardGrid>

      {successMessage ? (
        <DashboardSecondaryPanel className="border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {successMessage}
        </DashboardSecondaryPanel>
      ) : null}

      {errorMessage ? (
        <DashboardSecondaryPanel className="border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMessage}
        </DashboardSecondaryPanel>
      ) : null}

      <DashboardPrimaryPanel>
        <div className="section-header-copy">
          <p className="section-kicker">Broadcast Notifications</p>
          <h2 className="section-title">Notify every business account</h2>
          <p className="section-description">
            Sends one in-platform notification and one email to each live business account. Duplicate sends are blocked for recently identical broadcasts.
          </p>
        </div>

        <form action="/api/admin/platform/notifications" method="POST" className="mt-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-[var(--text-soft)]">
              <span className="form-label">Broadcast title</span>
              <input name="title" className="input-field mt-2" maxLength={140} required />
            </label>
            <label className="text-sm text-[var(--text-soft)]">
              <span className="form-label">Optional admin link</span>
              <input
                name="href"
                defaultValue="/admin"
                className="input-field mt-2"
                placeholder="/admin"
              />
            </label>
          </div>

          <label className="text-sm text-[var(--text-soft)]">
            <span className="form-label">Message</span>
            <textarea
              name="body"
              className="input-field mt-2 min-h-[132px]"
              maxLength={4000}
              required
            />
          </label>

          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-3 text-sm text-[var(--text-soft)]">
            This tool targets business accounts only. Public users and customer accounts are excluded.
          </div>

          <button type="submit" className="btn-primary px-4 py-2 text-sm font-medium">
            Send platform notification
          </button>
        </form>
      </DashboardPrimaryPanel>

      <DashboardGrid className="xl:grid-cols-[1.05fr,0.95fr]">
        <form
          id="platform-settings-form"
          action="/api/admin/platform"
          method="POST"
          className="dashboard-primary-panel space-y-5 p-6"
        >
          <input type="hidden" name="id" value={settings.id || ""} />
          <div className="section-header-copy">
            <p className="section-kicker">Platform Settings</p>
            <h2 className="section-title">Brand, support, and plan billing</h2>
            <p className="section-description">
              Manage public platform copy and the plan cards shown across pricing and upgrade surfaces.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-[var(--text-soft)]">
              <span className="form-label">Platform name</span>
              <input name="platform_name" defaultValue={settings.platform_name} className="input-field" />
            </label>
            <label className="text-sm text-[var(--text-soft)]">
              <span className="form-label">Support email</span>
              <input name="support_email" defaultValue={settings.support_email} className="input-field" />
            </label>
          </div>

          <label className="text-sm text-[var(--text-soft)]">
            <span className="form-label">Headline</span>
            <input
              name="marketing_headline"
              defaultValue={settings.marketing_headline}
              className="input-field"
            />
          </label>

          <label className="text-sm text-[var(--text-soft)]">
            <span className="form-label">Subheadline</span>
            <textarea
              name="marketing_subheadline"
              defaultValue={settings.marketing_subheadline}
              className="input-field min-h-[110px]"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-[var(--text-soft)]">
              <span className="form-label">Support phone</span>
              <input name="support_phone" defaultValue={settings.support_phone} className="input-field" />
            </label>
            <label className="text-sm text-[var(--text-soft)]">
              <span className="form-label">Pricing note</span>
              <input name="pricing_note" defaultValue={settings.pricing_note} className="input-field" />
            </label>
          </div>

          <PlatformPlansEditor initialPlans={settings.plans} />

          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] p-4 text-sm text-[var(--text-soft)]">
            Saving plan settings keeps Pro and Elite Stripe billing in sync while allowing extra display-only plans to be added or removed without changing core checkout logic.
          </div>

          <button type="submit" className="btn-primary px-4 py-2 text-sm font-medium">
            Save platform settings
          </button>
        </form>

        <div className="space-y-6">
          <PlatformBrandingPanel
            siteName={platformSiteName}
            previewLogoUrl={platformLogoUrl}
            storedLogoUrl={settings.logo_url}
            hasStoredLogo={Boolean(settings.logo_url)}
            logoAssetReachable={platformLogoAsset.reachable}
            maxLogoBytes={MAX_PLATFORM_LOGO_BYTES}
            formId="platform-settings-form"
          />

          <section className="dashboard-secondary-panel p-6">
            <div className="section-header-copy">
              <p className="section-kicker">Visible Plans</p>
              <h2 className="section-title">Current pricing cards</h2>
              <p className="section-description">
                Only active plans appear on public pricing and upgrade surfaces.
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {visiblePlans.map((plan) => (
                <div key={plan.id} className="table-row-panel p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-[var(--text-strong)]">{plan.name}</p>
                      <p className="mt-1 text-sm text-[var(--text-soft)]">{plan.subtitle}</p>
                      <p className="mt-2 text-xs text-[var(--text-muted)]">
                        {plan.billing_note}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-[var(--text-strong)]">
                        {formatMonthlyPriceLabel(plan.monthly_price_cents)}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        Fee {(plan.transaction_fee_bps / 100).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 border-t border-[var(--border-soft)] pt-6">
            <div className="section-header-copy">
              <p className="section-kicker">Platform Stripe</p>
              <h2 className="section-title">Platform payout and billing account</h2>
              <p className="section-description">
                Platform Stripe configuration stays isolated from tenant business Stripe Connect accounts.
              </p>
            </div>

            <div className="mt-5 space-y-3">
              <div className="table-row-panel flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[var(--text-soft)]">Stripe mode</span>
                <span className="text-sm font-medium text-[var(--text-strong)]">
                  {stripeEnvironment.configured
                    ? stripeEnvironment.mode === "live"
                      ? "Live"
                      : "Test"
                    : "Not configured"}
                </span>
              </div>
              <div className="table-row-panel flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[var(--text-soft)]">Secret key</span>
                <span className="text-sm font-medium text-[var(--text-strong)]">
                  {stripeEnvironment.configured ? "Configured" : "Missing"}
                </span>
              </div>
              <div className="table-row-panel flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[var(--text-soft)]">Publishable key</span>
                <span className="text-sm font-medium text-[var(--text-strong)]">
                  {stripeEnvironment.hasPublishableKey ? "Configured" : "Missing"}
                </span>
              </div>
              <div className="table-row-panel flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[var(--text-soft)]">Webhook secret</span>
                <span className="text-sm font-medium text-[var(--text-strong)]">
                  {stripeEnvironment.hasWebhookSecret ? "Configured" : "Missing"}
                </span>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-muted)] px-4 py-4 text-sm text-[var(--accent-soft)]">
              Business owners only manage payouts for their own business. Platform billing and pricing are locked to platform admin only.
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href="/api/admin/platform/stripe-dashboard"
                className="btn-primary px-4 py-2 text-sm font-medium"
              >
                {stripeEnvironment.configured ? "Manage Platform Stripe" : "Open Stripe Setup Status"}
              </a>
              <span className="btn-secondary inline-flex px-4 py-2 text-sm font-medium text-[var(--text-soft)]">
                {stripeEnvironment.dashboardUrl.replace("https://", "")}
              </span>
            </div>
          </div>
          </section>

          <section className="dashboard-secondary-panel p-6">
            <p className="section-kicker">Current Prices</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
              Managed plan billing state
            </h2>
            <div className="mt-5 space-y-3">
              <div className="table-row-panel p-4">
                <p className="text-sm text-[var(--text-soft)]">
                  Pro: <span className="text-[var(--text-strong)]">{formatMonthlyPriceLabel(settings.pro_monthly_price_cents)}</span> | {settings.pro_price_active ? "Active" : "Inactive"} | Fee {formatPlatformFeeBpsLabel(settings.pro_transaction_fee_bps)}
                </p>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  Live Stripe price: {proPricing.stripePrice?.id || "Not configured"} |{" "}
                  {proPricing.stripePrice?.unitAmountLabel || "No Stripe-backed amount"} |{" "}
                  {proPricing.stripePrice
                    ? proPricing.stripePrice.livemode
                      ? "Live mode"
                      : "Test mode"
                    : "No Stripe price"}
                </p>
              </div>
              <div className="table-row-panel p-4">
                <p className="text-sm text-[var(--text-soft)]">
                  Elite: <span className="text-[var(--text-strong)]">{formatMonthlyPriceLabel(settings.elite_monthly_price_cents)}</span> | {settings.elite_price_active ? "Active" : "Inactive"} | Fee {formatPlatformFeeBpsLabel(settings.elite_transaction_fee_bps)}
                </p>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  Live Stripe price: {elitePricing.stripePrice?.id || "Not configured"} |{" "}
                  {elitePricing.stripePrice?.unitAmountLabel || "No Stripe-backed amount"} |{" "}
                  {elitePricing.stripePrice
                    ? elitePricing.stripePrice.livemode
                      ? "Live mode"
                      : "Test mode"
                    : "No Stripe price"}
                </p>
              </div>
            </div>
          </section>

          <section className="dashboard-secondary-panel p-6">
            <p className="section-kicker">Elite Enforcement</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
              Included feature status
            </h2>
            <div className="mt-5 space-y-3">
              {ELITE_FEATURE_STATUS.map((item) => {
                const included = PLAN_DEFINITIONS.elite.features.includes(item.feature);
                return (
                  <div key={item.feature} className="table-row-panel p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-[var(--text-strong)]">{item.label}</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">{item.enforcement}</p>
                      </div>
                      <span className={included ? "status-chip" : "text-sm text-red-300"}>
                        {included ? "Elite active" : "Not included"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </DashboardGrid>

      <DashboardGrid className="xl:grid-cols-[1.2fr,0.8fr]">
        <div className="dashboard-primary-panel p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-kicker">Insights</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
                Top performing businesses
              </h2>
            </div>
            <span className="text-sm text-[var(--text-soft)]">
              Platform-wide gross volume
            </span>
          </div>
          <div className="mt-5 space-y-3">
            {platformData.topPerformingBusinesses.slice(0, 8).map((business) => (
              <div key={business.id} className="table-row-panel p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-[var(--text-strong)]">
                      {business.name}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-soft)]">
                      {business.businessType || "business"} - effective {business.effectivePlan} plan
                    </p>
                    {business.effectivePlan !== business.storedPlan ? (
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        Stored billing plan: {business.storedPlan}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      Owner {business.ownerEmail || "unknown"} - Last activity{" "}
                      {formatDateTime(business.lastActivityAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[var(--text-strong)]">
                      {formatCurrency(business.grossRevenue)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {business.transactions} txns
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <section className="dashboard-secondary-panel p-6">
            <p className="section-kicker">Income Audit</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
              Real revenue posture
            </h2>
            <div className="mt-4 space-y-3 text-sm text-[var(--text-soft)]">
              <p>
                Projected MRR from plan assignments:{" "}
                {formatCurrency(platformData.totalMRR)}
              </p>
              <p>
                Known stored platform fees:{" "}
                {formatCurrency(platformData.transactionPlatformRevenue)}
              </p>
              <p>
                Subscription ledger table present:{" "}
                {incomeAudit.hasSubscriptionLedger ? "Yes" : "No"}
              </p>
              <p>
                Stored order platform fees:{" "}
                {incomeAudit.hasStoredOrderPlatformFees ? "Yes" : "No"}
              </p>
            </div>
            <div className="mt-4 space-y-2 text-xs text-[var(--text-muted)]">
              {incomeAudit.notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          </section>

          <section className="dashboard-secondary-panel p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="section-kicker">Support</p>
                <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
                  Business-owner support
                </h2>
              </div>
              <Link
                href="/admin/messages"
                className="btn-secondary px-4 py-2 text-sm font-medium"
              >
                Open inbox
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {platformData.supportThreads.slice(0, 5).map((thread) => (
                <div key={thread.id} className="table-row-panel p-4">
                  <p className="font-medium text-[var(--text-strong)]">
                    {thread.businessName || "Business"}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">
                    {thread.ownerEmail || "Owner"} - {thread.unreadForPlatform}{" "}
                    unread
                  </p>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    {thread.lastMessageExcerpt || "No messages yet"}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </DashboardGrid>

      <DashboardGrid className="xl:grid-cols-[0.95fr,1.05fr]">
        <div className="dashboard-primary-panel p-6">
          <p className="section-kicker">Trial Grants</p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
            Grant private trial access
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">
            Attach trial access directly to an existing account or issue a
            one-time email-bound invite.
          </p>

          <form
            action="/api/admin/platform/access-grants"
            method="POST"
            className="mt-5 space-y-4"
          >
            <input type="hidden" name="action" value="grant_trial" />
            <label className="text-sm text-[var(--text-soft)]">
              <span className="form-label">Existing user email</span>
              <input name="email" type="email" required className="input-field" />
            </label>
            <label className="text-sm text-[var(--text-soft)]">
              <span className="form-label">Business ID</span>
              <input
                name="business_id"
                className="input-field"
                placeholder="Optional business scope"
              />
            </label>
            <label className="text-sm text-[var(--text-soft)]">
              <span className="form-label">Expires at</span>
              <input
                name="expires_at"
                type="datetime-local"
                className="input-field"
              />
            </label>
            <button
              type="submit"
              className="btn-primary px-4 py-2 text-sm font-medium"
            >
              Grant trial access
            </button>
          </form>

          <form
            action="/api/admin/platform/access-grants"
            method="POST"
            className="mt-8 space-y-4"
          >
            <input type="hidden" name="action" value="create_invite" />
            <label className="text-sm text-[var(--text-soft)]">
              <span className="form-label">Invite email</span>
              <input name="email" type="email" required className="input-field" />
            </label>
            <label className="text-sm text-[var(--text-soft)]">
              <span className="form-label">Business ID</span>
              <input
                name="business_id"
                className="input-field"
                placeholder="Optional business scope"
              />
            </label>
            <label className="text-sm text-[var(--text-soft)]">
              <span className="form-label">Invite expiry</span>
              <input
                name="expires_at"
                type="datetime-local"
                className="input-field"
              />
            </label>
            <button
              type="submit"
              className="btn-secondary px-4 py-2 text-sm font-medium"
            >
              Create email-bound invite
            </button>
          </form>
        </div>

        <div className="dashboard-secondary-panel p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-kicker">Active Grants</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
                Trial access inventory
              </h2>
            </div>
            <span className="text-sm text-[var(--text-soft)]">
              {activeGrants.length} active
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {activeGrants.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-8 text-sm text-[var(--text-soft)]">
                No active trial grants or invites.
              </div>
            ) : (
              activeGrants.map((grant) => (
                <div key={grant.id} className="table-row-panel p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-[var(--text-strong)]">
                        {grant.email || "No email"} | {grant.plan}
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-soft)]">
                        {grant.businessName ||
                          grant.businessId ||
                          "All businesses for account"}
                      </p>
                      <p className="mt-2 text-xs text-[var(--text-muted)]">
                        Granted by {grant.grantedBy || "unknown"} |{" "}
                        {formatDateTime(grant.grantedAt)}
                      </p>
                      {grant.expiresAt ? (
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          Expires {formatDateTime(grant.expiresAt)}
                        </p>
                      ) : null}
                      {grant.activatedAt ? (
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          Activated {formatDateTime(grant.activatedAt)}
                        </p>
                      ) : null}
                      {grant.inviteToken ? (
                        <p className="mt-2 break-all text-xs text-[var(--accent-soft)]">
                          Invite link: {grantCreateLinkBase}/signup?invite=
                          {grant.inviteToken}
                          {grant.email
                            ? `&email=${encodeURIComponent(grant.email)}`
                            : ""}
                        </p>
                      ) : null}
                    </div>
                    <form action="/api/admin/platform/access-grants" method="POST">
                      <input type="hidden" name="action" value="revoke_grant" />
                      <input type="hidden" name="grant_id" value={grant.id} />
                      <button
                        type="submit"
                        className="btn-secondary px-4 py-2 text-sm font-medium"
                      >
                        Revoke
                      </button>
                    </form>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DashboardGrid>

      <DashboardGrid className="xl:grid-cols-[0.95fr,1.05fr]">
        <div className="dashboard-primary-panel p-6">
          <p className="section-kicker">Manual Plan Grants</p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
            Grant temporary or permanent Pro and Elite access
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">
            Manual plan grants override billing-derived plan access without mutating Stripe
            subscription records. Temporary grants fall back automatically when they expire.
          </p>

          <div className="mt-5 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] p-4 text-sm text-[var(--text-soft)]">
            <p>Preset actions supported in this form:</p>
            <p className="mt-2">Pro permanent, Pro temporary, Elite permanent, Elite temporary.</p>
          </div>

          <form
            action="/api/admin/platform/plan-grants"
            method="POST"
            className="mt-5 space-y-4"
          >
            <input type="hidden" name="action" value="create_plan_grant" />
            <label className="text-sm text-[var(--text-soft)]">
              <span className="form-label">Existing user email</span>
              <input name="email" type="email" required className="input-field" />
            </label>
            <label className="text-sm text-[var(--text-soft)]">
              <span className="form-label">Business ID</span>
              <input
                name="business_id"
                className="input-field"
                placeholder="Optional business scope"
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm text-[var(--text-soft)]">
                <span className="form-label">Plan</span>
                <select name="granted_plan" className="input-field" defaultValue="elite">
                  <option value="elite">Elite</option>
                  <option value="pro">Pro</option>
                </select>
              </label>
              <label className="text-sm text-[var(--text-soft)]">
                <span className="form-label">Grant type</span>
                <select name="grant_type" className="input-field" defaultValue="temporary">
                  <option value="temporary">Temporary</option>
                  <option value="permanent">Permanent</option>
                </select>
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm text-[var(--text-soft)]">
                <span className="form-label">Duration preset</span>
                <select name="duration_preset" className="input-field" defaultValue="14d">
                  <option value="7d">7 days</option>
                  <option value="14d">14 days</option>
                  <option value="30d">30 days</option>
                  <option value="custom">Custom expiration date</option>
                </select>
              </label>
              <label className="text-sm text-[var(--text-soft)]">
                <span className="form-label">Custom expiration</span>
                <input
                  name="custom_expires_at"
                  type="datetime-local"
                  className="input-field"
                />
              </label>
            </div>
            <label className="text-sm text-[var(--text-soft)]">
              <span className="form-label">Reason</span>
              <textarea
                name="reason"
                className="input-field min-h-[110px]"
                placeholder="Why is this manual plan override being granted?"
              />
            </label>
            <button
              type="submit"
              className="btn-primary px-4 py-2 text-sm font-medium"
            >
              Create manual plan grant
            </button>
          </form>
        </div>

        <div className="dashboard-secondary-panel p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-kicker">Active Manual Grants</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
                Current plan overrides
              </h2>
            </div>
            <span className="text-sm text-[var(--text-soft)]">
              {activePlanGrants.length} active
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {activePlanGrants.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-8 text-sm text-[var(--text-soft)]">
                No active manual plan grants.
              </div>
            ) : (
              activePlanGrants.map((grant) => (
                <div key={grant.id} className="table-row-panel p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-[var(--text-strong)]">
                        {grant.email || grant.userId} | {grant.grantedPlan} | {grant.grantType}
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-soft)]">
                        {grant.scopeLabel}
                      </p>
                      <p className="mt-2 text-xs text-[var(--text-muted)]">
                        Granted by {grant.grantedBy || "unknown"} | Starts{" "}
                        {formatDateTime(grant.startsAt)}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        Effective now: {grant.effectivePlan} | Stored plan: {grant.storedPlan} |{" "}
                        {grant.appliesNow ? "grant currently in force" : "another plan currently wins"}
                      </p>
                      {grant.expiresAt ? (
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          Expires {formatDateTime(grant.expiresAt)}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          Permanent grant
                        </p>
                      )}
                      {grant.reason ? (
                        <p className="mt-2 text-xs text-[var(--text-muted)]">
                          Reason: {grant.reason}
                        </p>
                      ) : null}
                    </div>
                    <form action="/api/admin/platform/plan-grants" method="POST">
                      <input type="hidden" name="action" value="revoke_plan_grant" />
                      <input type="hidden" name="grant_id" value={grant.id} />
                      <button
                        type="submit"
                        className="btn-secondary px-4 py-2 text-sm font-medium"
                      >
                        Revoke
                      </button>
                    </form>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DashboardGrid>

      <section className="dashboard-primary-panel p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="section-kicker">Grant History</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
              Manual grant audit trail
            </h2>
          </div>
          <span className="text-sm text-[var(--text-soft)]">
            {planGrantHistory.length} total
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {planGrantHistory.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-8 text-sm text-[var(--text-soft)]">
              No manual grant history yet.
            </div>
          ) : (
            planGrantHistory.slice(0, 24).map((grant) => (
              <div key={grant.id} className="table-row-panel p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-[var(--text-strong)]">
                      {grant.email || grant.userId} | {grant.grantedPlan} | {grant.status}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-soft)]">
                      {grant.scopeLabel}
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      {grant.grantType} grant | Created {formatDateTime(grant.createdAt)} | Updated{" "}
                      {formatDateTime(grant.updatedAt)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Granted by {grant.grantedBy || "unknown"} | Starts{" "}
                      {formatDateTime(grant.startsAt)}
                      {grant.expiresAt ? ` | Expires ${formatDateTime(grant.expiresAt)}` : " | No expiry"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Effective now: {grant.effectivePlan} | Stored plan: {grant.storedPlan}
                    </p>
                    {grant.reason ? (
                      <p className="mt-2 text-xs text-[var(--text-muted)]">
                        Reason: {grant.reason}
                      </p>
                    ) : null}
                  </div>
                  <span className="status-chip">{grant.status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </AdminPageContainer>
  );
}
