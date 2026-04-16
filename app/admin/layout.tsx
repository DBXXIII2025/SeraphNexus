import Link from "next/link";
import { ReactNode } from "react";
import { headers } from "next/headers";
import { getUserBusinesses } from "@/lib/getBusinesses";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { getAdminNav, getBusinessModule, getPublicPath } from "@/lib/businessModules";
import { getPlanDefinition, getPlatformFeeLabel } from "@/lib/planConfig";
import { getConfiguredPlatformFee } from "@/lib/platformFees";
import { getPlatformAdminSession } from "@/lib/platformAdmin";
import { getTenantRecoveryState } from "@/lib/tenantRouting";
import { createAdminTranslator, translateAdminLabel } from "@/lib/adminI18n";
import BusinessSwitcher from "@/components/BusinessSwitcher";
import LogoutButton from "@/app/admin/LogoutButton";

const PLATFORM_OWNER_NAV = [
  { href: "/admin/dashboard", label: "Overview" },
  { href: "/admin/messages", label: "Support Inbox" },
  { href: "/admin/platform", label: "Platform Control" },
];

type NavGroup = {
  label: string;
  items: Array<{ href: string; label: string }>;
};

function groupOwnerNav(items: Array<{ href: string; label: string }>): NavGroup[] {
  const groups: NavGroup[] = [
    { label: "Workspace", items: [] },
    { label: "Operations", items: [] },
    { label: "Growth", items: [] },
    { label: "Configuration", items: [] },
  ];

  items.forEach((item) => {
    if (item.label === "Overview") {
      groups[0].items.push(item);
      return;
    }

    if (
      item.label === "Services" ||
      item.label === "Products" ||
      item.label === "Menu" ||
      item.label === "Inventory & Calendar" ||
      item.label === "Listings & Calendar" ||
      item.label === "Reservations" ||
      item.label === "Bookings" ||
      item.label === "Orders"
    ) {
      groups[1].items.push(item);
      return;
    }

    if (
      item.label === "Messages" ||
      item.label === "Payments" ||
      item.label === "Analytics" ||
      item.label === "Leads"
    ) {
      groups[2].items.push(item);
      return;
    }

    groups[3].items.push(item);
  });

  return groups.filter((group) => group.items.length > 0);
}

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const requestHeaders = await headers();
  const currentPath = requestHeaders.get("x-current-path") || "";
  const isCustomizeRoute = currentPath === "/admin/customize";
  const { user, isPlatformAdmin } = await getPlatformAdminSession();
  const businesses = await getUserBusinesses();
  const activeBusiness = await getActiveBusiness();
  const businessModule = getBusinessModule(activeBusiness?.business_type);
  const t = createAdminTranslator(activeBusiness?.language);
  const plan = getPlanDefinition(activeBusiness?.plan);
  const activePlatformFee = activeBusiness
    ? await getConfiguredPlatformFee(activeBusiness.plan)
    : null;
  const adminNav = getAdminNav(activeBusiness?.business_type, activeBusiness?.plan);
  const recovery =
    !isPlatformAdmin && activeBusiness && user?.id
      ? await getTenantRecoveryState({
          business: activeBusiness,
          userId: user.id,
        })
      : null;
  const isDev = process.env.NODE_ENV !== "production";

  if (isDev) {
    console.log("[admin/layout] mode", {
      isPlatformAdmin,
      activeBusinessId: activeBusiness?.id || null,
      activeBusinessType: activeBusiness?.business_type || null,
    });
  }

  if (isPlatformAdmin) {
    return (
      <div className="admin-shell min-h-screen bg-transparent text-[var(--text-main)]">
        <div className="relative mx-auto grid max-w-[1520px] gap-6 px-4 py-4 sm:px-6 lg:grid-cols-[312px,1fr] lg:px-8 lg:py-6">
          <aside className="shell-panel p-4 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:p-5">
            <div className="relative flex h-full flex-col gap-5">
              <div className="rounded-2xl border border-[rgba(193,18,31,0.16)] bg-[linear-gradient(180deg,rgba(193,18,31,0.14),rgba(143,12,21,0.06))] p-5">
                <div className="inline-flex rounded-full border border-[rgba(212,175,55,0.18)] bg-[rgba(212,175,55,0.08)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--accent-gold-soft)]">
                  Platform Owner
                </div>
                <div className="mt-4 space-y-2">
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">
                    Operator Account
                  </p>
                  <h1 className="text-2xl font-semibold text-[var(--text-strong)]">
                    {user?.email || "Platform owner"}
                  </h1>
                  <p className="text-sm leading-6 text-[var(--text-soft)]">
                    Platform-wide operations, support, revenue posture, and business health live
                    inside this admin experience.
                  </p>
                </div>
              </div>

              <nav className="flex-1 space-y-2">
                <div className="mb-2 px-1 text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">
                  Platform Navigation
                </div>
                {PLATFORM_OWNER_NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="nav-item text-sm font-medium"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span>{item.label}</span>
                      <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
                        Open
                      </span>
                    </div>
                  </Link>
                ))}
              </nav>

              <div className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(15,12,12,0.62)] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  Tenant isolation
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                  Business creation and workspace switching are hidden for the platform-owner
                  account to avoid mixing platform operations with tenant test data.
                </p>
              </div>

              <div className="border-t border-[var(--border-soft)] pt-4">
                <LogoutButton />
              </div>
            </div>
          </aside>

          <main className="min-w-0 space-y-6">
            <section className="premium-card p-6 lg:p-7">
              <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-4xl">
                  <p className="section-kicker">Platform Operations</p>
                  <h2 className="mt-3 text-3xl font-semibold text-[var(--text-strong)] lg:text-[2.15rem]">
                    Operate Seraph Nexus from the core admin console
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-soft)]">
                    This account runs platform oversight only. Tenant business creation and normal
                    business-owner workflows are intentionally hidden here.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(15,12,12,0.72)] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                      Current Mode
                    </p>
                    <p className="mt-2 text-lg font-semibold text-[var(--text-strong)]">
                      Platform owner
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-soft)]">
                      Global oversight replaces tenant-scoped operations.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[rgba(212,175,55,0.14)] bg-[rgba(212,175,55,0.06)] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                      Workspace State
                    </p>
                    <p className="mt-2 text-lg font-semibold text-[var(--accent-gold-soft)]">
                      Tenant creation disabled
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-soft)]">
                      Test businesses are managed from platform control only.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <div className="animate-page-in">{children}</div>
          </main>
        </div>
      </div>
    );
  }

  if (isDev) {
    console.log(
      "[admin/layout] nav config:",
      adminNav.map((item) => item.label)
    );
  }

  if (isCustomizeRoute) {
    return (
      <div className="min-h-screen bg-[#f4f6f8] text-slate-900">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Business website builder
              </p>
              <h1 className="mt-1 text-xl font-semibold text-slate-950">
                {activeBusiness?.name || "Business profile"}
              </h1>
            </div>
            <nav className="flex flex-wrap gap-2 text-sm">
              <Link
                href="/admin"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 font-medium text-slate-800"
              >
                Admin
              </Link>
              <Link
                href="/admin/settings"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 font-medium text-slate-800"
              >
                Settings
              </Link>
              {activeBusiness?.slug ? (
                <Link
                  href={getPublicPath(activeBusiness.business_type, activeBusiness.slug)}
                  className="rounded-md bg-slate-950 px-3 py-2 font-medium text-white"
                >
                  Public page
                </Link>
              ) : null}
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </div>
    );
  }

  return (
    <div className="admin-shell min-h-screen bg-transparent text-[var(--text-main)]">
      <div className="relative mx-auto grid max-w-[1520px] gap-6 px-4 py-4 sm:px-6 lg:grid-cols-[312px,1fr] lg:px-8 lg:py-6">
        <aside className="shell-panel p-4 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:p-5">
          <div className="relative flex h-full flex-col gap-4">
            <div className="rounded-2xl border border-[rgba(193,18,31,0.16)] bg-[linear-gradient(180deg,rgba(193,18,31,0.14),rgba(143,12,21,0.06))] p-4">
              <div className="inline-flex rounded-full border border-[rgba(212,175,55,0.18)] bg-[rgba(212,175,55,0.08)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-gold-soft)]">
                {t("ownerWorkspace")}
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  {t("activeBusiness")}
                </p>
                <h1 className="text-[1.65rem] font-semibold text-[var(--text-strong)]">
                  {activeBusiness?.name || t("noActiveBusiness")}
                </h1>
                <p className="text-sm leading-6 text-[var(--text-soft)]">
                  {businessModule.label} operations with live controls for bookings, payments,
                  messaging, and launch readiness.
                </p>
              </div>
              {activeBusiness ? (
                <>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="inline-flex rounded-full border border-[rgba(193,18,31,0.18)] bg-[rgba(193,18,31,0.12)] px-3 py-1 text-xs font-medium text-[var(--accent-soft)]">
                      {plan.label} plan
                    </span>
                    <span className="inline-flex rounded-full border border-[rgba(212,175,55,0.2)] bg-[rgba(212,175,55,0.08)] px-3 py-1 text-xs font-medium text-[var(--accent-gold-soft)]">
                      {activePlatformFee?.label || getPlatformFeeLabel(activeBusiness.plan)} platform fee
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2">
                    <Link
                      href={businessModule.primaryAdminHref}
                      className="btn-secondary px-4 py-2 text-sm font-medium"
                    >
                      {t("open")} {translateAdminLabel(activeBusiness.language, businessModule.primaryAdminLabel)}
                    </Link>
                    {activeBusiness.slug ? (
                      <Link
                        href={getPublicPath(activeBusiness.business_type, activeBusiness.slug)}
                        className="btn-secondary px-4 py-2 text-sm font-medium"
                      >
                        {t("openPublicPage")}
                      </Link>
                    ) : (
                      <Link
                        href="/admin/settings"
                        className="btn-secondary px-4 py-2 text-sm font-medium"
                      >
                        {t("publishAndPayoutSettings")}
                      </Link>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            <div className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(15,12,12,0.62)] p-4">
              <p className="mb-3 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {t("workspaceScope")}
              </p>
              <BusinessSwitcher
                businesses={businesses}
                activeBusinessId={activeBusiness?.id}
              />
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {groupOwnerNav(adminNav).map((group) => (
                <nav key={group.label} className="mb-6 space-y-2">
                  <div className="mb-2 px-1 text-[11px] font-semibold tracking-[0.18em] text-[var(--text-muted)] uppercase">
                    {translateAdminLabel(activeBusiness?.language, group.label)}
                  </div>
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="nav-item text-sm font-medium"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span>{translateAdminLabel(activeBusiness?.language, item.label)}</span>
                        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        {t("open")}
                        </span>
                      </div>
                    </Link>
                  ))}
                </nav>
              ))}
            </div>

            {!activeBusiness ? (
              <div className="rounded-2xl border border-[rgba(212,175,55,0.18)] bg-[rgba(212,175,55,0.08)] px-4 py-4 text-sm text-[var(--text-soft)]">
                Create or select a business to manage launch settings.
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(15,12,12,0.62)] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {t("commandFocus")}
                </p>
                <div className="mt-3 space-y-2 text-sm text-[var(--text-soft)]">
                  <p>Publish readiness, revenue, conversations, and inventory remain scoped to this business.</p>
                <p>Use {t("dashboard")} for priorities first, then move into {t("operations").toLowerCase()} or {t("settings").toLowerCase()}.</p>
                </div>
              </div>
            )}

            <div className="border-t border-[var(--border-soft)] pt-4">
              <LogoutButton />
            </div>
          </div>
        </aside>

        <main className="min-w-0 space-y-6">
          {!isCustomizeRoute ? (
          <section className="premium-card p-6 lg:p-7">
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-4xl">
                <p className="section-kicker">{t("operationsConsole")}</p>
                <h2 className="mt-3 text-3xl font-semibold text-[var(--text-strong)] lg:text-[2.15rem]">
                  Run the business from a tighter operational command center
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-soft)]">
                  Prioritize launch posture, customer activity, payments, inventory, and service
                  delivery from one workspace organized around the active business context.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px]">
                <Link
                  href={businessModule.primaryAdminHref}
                  className="table-row-panel p-4 transition hover:border-[rgba(212,175,55,0.16)]"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                    {t("primaryModule")}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-[var(--text-strong)]">
                    {translateAdminLabel(activeBusiness?.language, businessModule.primaryAdminLabel)}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">
                    Open the core operational surface for {activeBusiness?.name || "this workspace"}.
                  </p>
                </Link>
                <Link
                  href="/admin/settings"
                  className="rounded-2xl border border-[rgba(212,175,55,0.14)] bg-[rgba(212,175,55,0.06)] p-4 transition hover:border-[rgba(212,175,55,0.22)]"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                    {t("launchControl")}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-[var(--accent-gold-soft)]">
                    {t("publishAndPayoutSettings")}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">
                    Manage readiness, Stripe posture, and public visibility.
                  </p>
                </Link>
              </div>
            </div>
          </section>
          ) : null}

          {recovery && !recovery.readiness.canPublishLive && !isCustomizeRoute ? (
            <section className="surface-card p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="section-kicker">{t("continueSetup")}</p>
                  <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
                    {recovery.readiness.label}
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-soft)]">
                    {recovery.reason}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                    Completed {recovery.readiness.onboarding.completedCount} of{" "}
                    {recovery.readiness.onboarding.totalCount} setup steps for{" "}
                    {activeBusiness?.name || "this business"}.
                  </p>
                </div>

                <div className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(15,12,12,0.58)] p-4 lg:min-w-[260px]">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                    Recovery Action
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                    {recovery.label}
                  </p>
                  <Link
                    href={recovery.href}
                    className="btn-secondary mt-4 inline-flex w-full justify-center px-4 py-2 text-sm font-medium"
                  >
                    {t("continueSetup")}
                  </Link>
                </div>
              </div>
            </section>
          ) : null}

          <div className="animate-page-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
