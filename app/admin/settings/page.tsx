import { redirect } from "next/navigation";
import { getBusinessProfileCompletion } from "@/lib/businessProfileCompletion";
import { getBusinessReadinessState } from "@/lib/businessReadiness";
import { loadBusinessLogoById } from "@/lib/businessLogos";
import ConnectStripeButton from "@/components/ConnectStripeButton";
import BusinessLogoManager from "@/app/admin/settings/BusinessLogoManager";
import BusinessPreferencesForm from "@/app/admin/settings/BusinessPreferencesForm";
import PublicBusinessLink from "@/app/admin/settings/PublicBusinessLink";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { getPaymentReadiness } from "@/lib/paymentReadiness";
import { canAccessPlanFeature, getPlanDefinition } from "@/lib/planConfig";
import { getFeatureGate } from "@/lib/planEnforcement";
import { getPlatformAdminSession } from "@/lib/platformAdmin";
import { createClient } from "@/lib/supabase/server";
import { loadBusinessPreferences } from "@/lib/businessPreferences";
import { createAdminTranslator } from "@/lib/adminI18n";
import { loadBusinessStaffMembers } from "@/lib/businessStaff";

type SettingsPageProps = {
  searchParams?: Promise<{
    businessId?: string;
    setup?: string;
    stripe?: string;
    message?: string;
  }>;
};

type SettingsBusiness = {
  id: string;
  owner_id?: string | null;
  name: string | null;
  slug?: string | null;
  description?: string | null;
  business_type?: string | null;
  plan?: string | null;
  is_published?: boolean | null;
  stripe_account_id?: string | null;
  stripe_onboarding_complete?: boolean | null;
  stripe_charges_enabled?: boolean | null;
  stripe_payouts_enabled?: boolean | null;
  language?: "en" | "es" | null;
  pickup_enabled?: boolean | null;
  delivery_enabled?: boolean | null;
  onsite_enabled?: boolean | null;
  remote_enabled?: boolean | null;
  access_role?: "owner" | "admin" | "manager" | "staff";
};

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

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const { user, isPlatformAdmin } = await getPlatformAdminSession();

  if (isPlatformAdmin) {
    redirect("/admin/platform");
  }

  const params = searchParams ? await searchParams : undefined;
  const businessId = params?.businessId?.trim();
  const business = (await getActiveBusiness(businessId)) as SettingsBusiness | null;
  const t = createAdminTranslator(business?.language);
  const logoState = business ? await loadBusinessLogoById(business.id) : null;
  const supabase = await createClient();
  const businessPreferences = business
    ? await loadBusinessPreferences(supabase, business.id)
    : null;

  const setup = params?.setup;
  const stripeState = params?.stripe;
  const message = params?.message;
  const paymentReadiness = business ? getPaymentReadiness(business) : null;
  const plan = business ? getPlanDefinition(business.plan) : null;
  const canUsePayments = business
    ? canAccessPlanFeature(business.plan, "stripe_payments")
    : false;
  const canUseStandardCustomization = business
    ? canAccessPlanFeature(business.plan, "standard_customization")
    : false;
  const canUseAdvancedCustomization = business
    ? canAccessPlanFeature(business.plan, "advanced_customization")
    : false;
  const canUseTeamRoles = business ? canAccessPlanFeature(business.plan, "team_roles") : false;
  const canManageTeam =
    Boolean(business?.owner_id && user?.id && business.owner_id === user.id) ||
    business?.access_role === "admin";
  const publishGate = business
    ? getFeatureGate(
        business.plan,
        "publish_business",
        "Publishing is available on Pro and Elite."
      )
    : null;
  const profileCompletion = business ? getBusinessProfileCompletion(business) : null;
  const readiness =
    business && user?.id
      ? await getBusinessReadinessState({
          business,
          userId: user.id,
        })
      : null;
  const staffState = business ? await loadBusinessStaffMembers(business.id) : null;

  return (
    <div className="space-y-6 text-[var(--text-main)]">
      <section className="premium-card p-6 lg:p-7">
        <div className="section-header-copy">
          <p className="section-kicker">{t("settings")}</p>
          <h1 className="section-title">Business identity, payouts, and launch control</h1>
          <p className="section-description">
            Manage identity, payout posture, and publish readiness for the active business.
          </p>
        </div>
      </section>

      {setup === "stripe" && paymentReadiness?.status === "not_started" ? (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
          Connect Stripe next so this business can accept payments.
        </div>
      ) : null}
      {stripeState === "connected" ? (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">
          Stripe onboarding returned successfully. Account status has been refreshed.
        </div>
      ) : null}
      {stripeState === "refresh" ? (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
          Stripe status was refreshed. Review the payment readiness panel below for the next step.
        </div>
      ) : null}
      {stripeState === "error" ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {message || "Stripe onboarding could not be completed."}
        </div>
      ) : null}
      {message === "published" ? (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">
          Business published successfully. It is now visible on public routes.
        </div>
      ) : null}
      {message === "unpublished" ? (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
          Business unpublished successfully. It is no longer publicly visible.
        </div>
      ) : null}
      {message === "publish-error" ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          Publish status could not be updated.
        </div>
      ) : null}
      {message === "forbidden" ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          You do not have permission to publish this business.
        </div>
      ) : null}
      {message === "missing-business" ? (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
          Select an active business before trying to change publish state.
        </div>
      ) : null}
      {message === "profile-incomplete" ? (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
          Complete the business profile before publishing. Add the missing public details in the business profile editor.
        </div>
      ) : null}
      {message === "readiness-incomplete" ? (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
          This business is not publish-ready yet. Review the readiness blockers below and complete the next required step.
        </div>
      ) : null}
      {message === "publish-plan-locked" ? (
        <div className="rounded-xl border border-[rgba(212,175,55,0.24)] bg-[rgba(212,175,55,0.1)] px-4 py-3 text-sm text-[var(--accent-gold-soft)]">
          Publishing is locked on the {plan?.label || "current"} plan. Upgrade to Pro or Elite to
          make this business visible on Explore and public routes.
        </div>
      ) : null}

      {!business ? (
        <div className="empty-state">{t("noActiveBusinessFound")}</div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.08fr,0.92fr]">
          <div className="space-y-6">
            <section className="surface-card p-6">
              <div className="section-header-copy">
                  <p className="section-kicker">{t("settings")}</p>
                <h2 className="section-title">Business identity</h2>
                <p className="section-description">
                  Upload a compact logo for admin identity blocks and public-facing headers.
                </p>
              </div>

              <div className="mt-5">
                <BusinessLogoManager
                  businessId={business.id}
                  businessName={business.name || "Active business"}
                  initialLogoUrl={logoState?.logoUrl || null}
                  isConfigured={logoState?.schemaReady ?? false}
                  configurationMessage={logoState?.errorMessage || null}
                  lockedMessage={
                    canUseStandardCustomization
                      ? null
                      : `Logo customization is locked on the ${plan?.label || "current"} plan. Upgrade to Pro or Elite for standard brand customization.`
                  }
                />
              </div>

              <div className="form-section mt-5 text-sm text-[var(--text-soft)]">
                This logo stays compact by design. It reinforces trust and business identity without turning settings or public pages into image-led layouts.
              </div>
            </section>

            <PublicBusinessLink
              slug={business.slug}
              isPublished={business.is_published}
            />

            <BusinessPreferencesForm
              business={{
                ...business,
                ...(businessPreferences || {}),
              }}
            />

            <section className="surface-card p-6">
              <div className="section-header">
                <div className="section-header-copy">
                  <p className="section-kicker">Profile</p>
                  <h2 className="section-title">Business profile</h2>
                  <p className="section-description">
                    Core public business details used across public pages.
                  </p>
                </div>
                <a
                  href={`/admin/customize?businessId=${encodeURIComponent(business.id)}`}
                  className="btn-secondary px-4 py-2 text-sm font-medium"
                >
                  {t("editBusinessProfile")}
                </a>
              </div>

              <div className="mt-5 space-y-3">
                <StatusRow
                  label="Profile readiness"
                  value={profileCompletion?.canPublishProfile ? "Ready" : "Needs details"}
                />
                <StatusRow
                  label="Completion"
                  value={`${profileCompletion?.progressPercent || 0}%`}
                />
              </div>

              {profileCompletion ? (
                <div className="mt-5 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
                  {profileCompletion.summary}
                </div>
              ) : null}
            </section>
          </div>

          <div className="space-y-6">
            {readiness ? (
              <section className="premium-card p-6">
                <div className="section-header-copy">
                  <p className="section-kicker">{t("launchControl")}</p>
                  <h2 className="section-title">Launch readiness</h2>
                  <p className="section-description">
                    Combined status across profile, legal, payments, and offerings.
                  </p>
                </div>

                <div className="mt-5 space-y-3">
                  <StatusRow label="Readiness status" value={readiness.label} />
                  <StatusRow
                    label="Public live state"
                    value={readiness.isLive ? "Live" : business.is_published ? "Published with blockers" : "Not live"}
                  />
                </div>

                <div className="mt-5 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
                  {readiness.summary}
                </div>

                {readiness.blockers.length > 0 ? (
                  <div className="mt-5 space-y-3">
                    {readiness.blockers.map((blocker) => (
                      <div key={blocker.id} className="form-section">
                        <p className="text-sm font-medium text-[var(--text-strong)]">
                          {blocker.label}
                        </p>
                        <p className="mt-1 text-sm text-[var(--text-soft)]">{blocker.description}</p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {!readiness.isLive ? (
                  <div className="mt-5">
                    <a
                      href={readiness.nextActionHref}
                      className="btn-secondary px-4 py-2 text-sm font-medium"
                    >
                      {readiness.nextActionLabel}
                    </a>
                  </div>
                ) : null}
              </section>
            ) : null}

            <section className="surface-card p-6">
              <div className="section-header-copy">
                <p className="section-kicker">{t("payments")}</p>
                <h2 className="section-title">Stripe Connect</h2>
                <p className="section-description">
                  Stripe Connect status and payout posture for {business.name || "this business"}.
                </p>
              </div>

              <div className="mt-5 space-y-3">
                <StatusRow
                  label="Connection state"
                  value={getStripeConnectionState(business)}
                />
                <StatusRow label="Stripe account ID" value={business.stripe_account_id || "Not connected"} />
                <StatusRow label="Onboarding complete" value={Boolean(business.stripe_onboarding_complete)} />
                <StatusRow label="Charges enabled" value={Boolean(business.stripe_charges_enabled)} />
                <StatusRow label="Payouts enabled" value={Boolean(business.stripe_payouts_enabled)} />
                <StatusRow label="Payment readiness" value={paymentReadiness?.label || "Unknown"} />
              </div>

              {paymentReadiness ? (
                <div className="mt-5 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
                  {paymentReadiness.summary}
                </div>
              ) : null}

              {!canUsePayments ? (
                <div className="mt-5 rounded-lg border border-[rgba(212,175,55,0.18)] bg-[rgba(212,175,55,0.08)] px-4 py-3 text-sm text-[var(--accent-gold-soft)]">
                  Stripe payments are available on Pro and Elite. Upgrade this business to connect
                  Stripe and accept live bookings or orders.
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-3">
                {canUsePayments && !business.stripe_account_id ? (
                  <ConnectStripeButton
                    businessId={business.id}
                    label="Connect Stripe"
                    loadingLabel="Redirecting to Stripe setup..."
                    className="w-full sm:w-auto lg:w-auto"
                  />
                ) : null}
                {canUsePayments &&
                business.stripe_account_id &&
                paymentReadiness?.status !== "payment_ready" ? (
                  <ConnectStripeButton
                    businessId={business.id}
                    label="Continue Stripe Setup"
                    loadingLabel="Redirecting to Stripe setup..."
                    className="w-full sm:w-auto lg:w-auto"
                  />
                ) : null}
                {canUsePayments && business.stripe_account_id ? (
                  <ConnectStripeButton
                    businessId={business.id}
                    endpoint="/api/stripe/manage"
                    label="Manage Stripe Account"
                    loadingLabel="Opening Stripe account..."
                    className="w-full sm:w-auto lg:w-auto"
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
            </section>

            <section className="surface-card p-6">
              <div className="section-header-copy">
                <p className="section-kicker">Publishing</p>
                <h2 className="section-title">Publish business</h2>
                <p className="section-description">
                  Control whether this business is discoverable on Explore and public client routes.
                </p>
              </div>

              <div className="mt-5 space-y-3">
                <StatusRow label="Public visibility" value={business.is_published ? "Published" : "Unpublished"} />
                <StatusRow label="Public slug" value={business.slug || "No slug set"} />
              </div>

              <div className="form-section mt-5 text-sm text-[var(--text-soft)]">
                {business.is_published
                  ? "This business is currently visible on public routes and Explore."
                  : "This business is currently hidden from Explore and public slug routes."}
              </div>

              {profileCompletion && !profileCompletion.canPublishProfile ? (
                <div className="mt-5 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
                  This business cannot be published live until its public profile is complete. Add the core business details in the profile editor first.
                </div>
              ) : null}

              {paymentReadiness && !paymentReadiness.canPublishLive ? (
                <div className="mt-5 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
                  This business cannot be published live until payment setup is ready. Complete Stripe onboarding and enable charges and payouts first.
                </div>
              ) : null}
              {publishGate && !publishGate.allowed ? (
                <div className="mt-5 rounded-lg border border-[rgba(212,175,55,0.18)] bg-[rgba(212,175,55,0.08)] px-4 py-3 text-sm text-[var(--accent-gold-soft)]">
                  Publishing is locked on {plan?.label || "the current"} plan. Upgrade to Pro or
                  Elite before making this business visible publicly.
                </div>
              ) : null}

              <form action="/api/admin/business/publish" method="POST" className="mt-5">
                <input type="hidden" name="business_id" value={business.id} />
                <input type="hidden" name="is_published" value={business.is_published ? "false" : "true"} />
                <button
                  type="submit"
                  disabled={
                    (!business.is_published && !readiness?.canPublishLive) ||
                    (!business.is_published && publishGate?.allowed === false)
                  }
                  className={
                    business.is_published
                      ? "rounded-xl border border-red-500/30 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/10"
                      : "btn-primary px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                  }
                >
                  {business.is_published ? "Unpublish business" : "Publish business"}
                </button>
              </form>
              {!business.is_published && publishGate?.allowed === false ? (
                <a
                  href="/admin/upgrade"
                  className="btn-secondary mt-3 inline-flex px-4 py-2 text-sm font-medium"
                >
                  Upgrade for publishing
                </a>
              ) : null}
            </section>

            <section className="surface-card p-6">
              <div className="section-header-copy">
                <p className="section-kicker">Premium Controls</p>
                <h2 className="section-title">Advanced customization and roles</h2>
                <p className="section-description">
                  Elite unlocks advanced workspace branding, future staff roles, and premium
                  operational controls.
                </p>
              </div>

              <div className="mt-5 space-y-3">
                <StatusRow
                  label="Standard customization"
                  value={canUseStandardCustomization ? "Enabled" : "Locked"}
                />
                <StatusRow
                  label="Advanced customization"
                  value={canUseAdvancedCustomization ? "Enabled" : "Elite only"}
                />
              </div>

              {!canUseAdvancedCustomization ? (
                <div className="mt-5 rounded-lg border border-[rgba(212,175,55,0.18)] bg-[rgba(212,175,55,0.08)] px-4 py-3 text-sm text-[var(--accent-gold-soft)]">
                  Advanced customization, team and staff roles, and premium workspace controls are
                  reserved for Elite.
                </div>
              ) : (
                <div className="mt-5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  Elite access is active for advanced branding, staff roles, and premium
                  workspace controls.
                </div>
              )}
            </section>

            <section className="surface-card p-6">
              <div className="section-header-copy">
                <p className="section-kicker">Team Roles</p>
                <h2 className="section-title">Staff access roster</h2>
                <p className="section-description">
                  Elite businesses can maintain a business-scoped staff roster with role intent for
                  operational access and audit review.
                </p>
              </div>

              {!canUseTeamRoles ? (
                <div className="mt-5 rounded-lg border border-[rgba(212,175,55,0.18)] bg-[rgba(212,175,55,0.08)] px-4 py-3 text-sm text-[var(--accent-gold-soft)]">
                  Team and staff roles require Elite.
                </div>
              ) : staffState?.error ? (
                <div className="mt-5 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
                  {staffState.error}
                </div>
              ) : (
                <>
                  {canManageTeam ? (
                    <form action="/api/admin/team" method="POST" className="mt-5 grid gap-3 md:grid-cols-[1fr,160px,auto]">
                      <input type="hidden" name="action" value="add" />
                      <input
                        name="email"
                        type="email"
                        required
                        placeholder="staff@example.com"
                        className="input-field"
                      />
                      <select name="role" defaultValue="staff" className="input-field">
                        <option value="staff">Staff</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button type="submit" className="btn-primary px-4 py-2 text-sm font-medium">
                        Add staff
                      </button>
                    </form>
                  ) : (
                    <div className="mt-5 rounded-lg border border-[var(--border-soft)] bg-[rgba(15,12,12,0.56)] px-4 py-3 text-sm text-[var(--text-soft)]">
                      Staff roster changes require owner or admin access.
                    </div>
                  )}

                  <div className="mt-5 space-y-3">
                    {(staffState?.members || []).length === 0 ? (
                      <div className="empty-state">No staff members added yet.</div>
                    ) : (
                      staffState?.members.map((member) => (
                        <div key={member.id} className="table-row-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                          <div>
                            <p className="font-medium text-[var(--text-strong)]">{member.email}</p>
                            <p className="text-sm capitalize text-[var(--text-soft)]">
                              {member.role} | {member.status}
                            </p>
                          </div>
                          {canManageTeam ? (
                            <form action="/api/admin/team" method="POST">
                              <input type="hidden" name="action" value="deactivate" />
                              <input type="hidden" name="staff_id" value={member.id} />
                              <button type="submit" className="btn-secondary px-3 py-2 text-sm">
                                Remove
                              </button>
                            </form>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
