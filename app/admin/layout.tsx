import { ReactNode } from "react";
import { headers } from "next/headers";
import { getUserBusinesses } from "@/lib/getBusinesses";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { getAdminNav, getBusinessModule, getPublicPath } from "@/lib/businessModules";
import { getPlatformAdminSession } from "@/lib/platformAdmin";
import { getTenantRecoveryState } from "@/lib/tenantRouting";
import { createAdminTranslator, translateAdminLabel } from "@/lib/adminI18n";
import { resolvePlatformLogoUrl, resolvePlatformName } from "@/lib/platformBranding";
import { getPlatformSettings } from "@/lib/platformSettings";
import BusinessSwitcher from "@/components/BusinessSwitcher";
import LogoutButton from "@/app/admin/LogoutButton";
import AdminNotificationBell from "@/components/notifications/AdminNotificationBell";
import {
  AdminActionLink,
  AdminNavLink,
  AdminPageHeader,
  AdminPanel,
  AdminShell,
  AdminSidebarBrand,
  AdminSidebarSection,
  AdminTopNav,
} from "@/components/admin/AdminLayoutSystem";

const PLATFORM_OWNER_NAV = [
  { href: "/admin/dashboard", label: "Overview" },
  { href: "/admin/businesses", label: "Businesses" },
  { href: "/admin/messages", label: "Support Inbox" },
  { href: "/admin/revenue", label: "Revenue" },
  { href: "/admin/platform", label: "Platform Control" },
];

type NavGroup = {
  label: string;
  items: Array<{ href: string; label: string }>;
};

const sidebarStackStyle = {
  height: "100%",
  minHeight: 0,
  overflow: "hidden",
} as const;

const sidebarScrollStyle = {
  flex: "1 1 auto",
  minHeight: 0,
  display: "grid",
  alignContent: "start",
  gap: "0.8rem",
  overflowY: "auto",
  paddingRight: "0.2rem",
} as const;

const sidebarFooterStyle = {
  display: "grid",
  flex: "0 0 auto",
  gap: "0.8rem",
} as const;

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
  const platformSettings = await getPlatformSettings();
  const platformName = resolvePlatformName(platformSettings);
  const platformLogoUrl = resolvePlatformLogoUrl(platformSettings);
  const businesses = await getUserBusinesses();
  const activeBusiness = await getActiveBusiness();
  const businessModule = getBusinessModule(activeBusiness?.business_type);
  const t = createAdminTranslator(activeBusiness?.language);
  const adminNav = getAdminNav(activeBusiness?.business_type);
  const switcherBusinesses = businesses.map((business) => ({
    id: business.id,
    name: business.name || "Untitled business",
  }));
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
      canonicalControlCenter: "/admin",
    });
    console.log("[platform-branding] admin header branding payload read", {
      platformName: platformSettings.platform_name,
      rawLogoUrl: platformSettings.logo_url,
      resolvedLogoUrl: platformLogoUrl,
      renderDecision: platformLogoUrl ? "logo" : "fallback",
      imageComponent: "img",
    });
  }

  if (isPlatformAdmin) {
    return (
      <AdminShell
        topbar={
          <AdminTopNav
            eyebrow="Platform Owner"
            title={user?.email || "Platform owner"}
            description="Platform operations, support, and owner controls."
            actions={
              <>
                {user?.id ? <AdminNotificationBell userId={user.id} /> : null}
                <LogoutButton />
              </>
            }
          />
        }
        sidebar={
          <div className="admin-sidebar-stack" style={sidebarStackStyle}>
            <div className="admin-sidebar-scroll" style={sidebarScrollStyle}>
              <AdminSidebarBrand
                brandName={platformName}
                brandLogoUrl={platformLogoUrl}
                eyebrow="Seraph Nexus"
                title="Platform console"
              />
              <AdminSidebarSection title="Platform Navigation">
                <nav className="admin-sidebar-nav">
                  {PLATFORM_OWNER_NAV.map((item) => (
                    <AdminNavLink
                      key={item.href}
                      href={item.href}
                      active={currentPath === item.href}
                    >
                      {item.label}
                    </AdminNavLink>
                  ))}
                </nav>
              </AdminSidebarSection>
            </div>

            <div className="admin-sidebar-footer" style={sidebarFooterStyle}>
              <AdminSidebarSection title="Utilities">
                <nav className="admin-sidebar-nav">
                  <AdminNavLink href="/admin/support" active={currentPath === "/admin/support"}>
                    Support
                  </AdminNavLink>
                  <AdminNavLink href="/pricing" active={currentPath === "/pricing"}>
                    Upgrade
                  </AdminNavLink>
                </nav>
              </AdminSidebarSection>

              <AdminSidebarSection title="Tenant isolation">
                <p className="admin-muted">
                  Business creation and workspace switching are hidden for this account.
                </p>
              </AdminSidebarSection>
            </div>
          </div>
        }
      >
        <AdminPageHeader
          eyebrow="Admin Console"
          title="Platform Operations"
          description="Operate Seraph Nexus from the admin console."
        />
        {children}
      </AdminShell>
    );
  }

  if (isCustomizeRoute) {
    return (
      <AdminShell
        wide
        topbar={
          <AdminTopNav
            eyebrow="Business website builder"
            title={activeBusiness?.name || "Business profile"}
            description="Edit the live business profile, gallery, theme, and public actions."
            actions={
              <>
                {user?.id ? <AdminNotificationBell userId={user.id} /> : null}
                <AdminActionLink href="/admin">Admin</AdminActionLink>
                <AdminActionLink href="/admin/settings">Settings</AdminActionLink>
                {activeBusiness?.slug ? (
                  <AdminActionLink
                    href={getPublicPath(activeBusiness.business_type, activeBusiness.slug)}
                    tone="primary"
                  >
                    Public page
                  </AdminActionLink>
                ) : null}
              </>
            }
          />
        }
      >
        {children}
      </AdminShell>
    );
  }

  return (
    <AdminShell
      topbar={
        <AdminTopNav
          eyebrow={t("ownerWorkspace")}
          title={activeBusiness?.name || t("noActiveBusiness")}
          description={`${businessModule.label} operations and public business management.`}
          actions={
            <>
              {user?.id ? <AdminNotificationBell userId={user.id} /> : null}
              {activeBusiness ? (
                <>
                  <AdminActionLink href={businessModule.primaryAdminHref} tone="primary">
                    {t("open")}{" "}
                    {translateAdminLabel(activeBusiness.language, businessModule.primaryAdminLabel)}
                  </AdminActionLink>
                  {activeBusiness.slug ? (
                    <AdminActionLink href={getPublicPath(activeBusiness.business_type, activeBusiness.slug)}>
                      {t("openPublicPage")}
                    </AdminActionLink>
                  ) : (
                    <AdminActionLink href="/admin/settings">
                      {t("publishAndPayoutSettings")}
                    </AdminActionLink>
                  )}
                </>
              ) : null}
              <LogoutButton />
            </>
          }
        />
      }
      sidebar={
        <div className="admin-sidebar-stack" style={sidebarStackStyle}>
          <div className="admin-sidebar-scroll" style={sidebarScrollStyle}>
            <AdminSidebarBrand
              brandName={platformName}
              brandLogoUrl={platformLogoUrl}
              eyebrow={translateAdminLabel(activeBusiness?.language, businessModule.label)}
              title={activeBusiness?.name || t("noActiveBusiness")}
            />
              <AdminSidebarSection title={t("workspaceScope")}>
                <BusinessSwitcher
                  businesses={switcherBusinesses}
                  activeBusinessId={activeBusiness?.id}
                  label={t("activeBusiness")}
                  emptyStateLabel={t("noActiveBusinessFound")}
                  savingLabel={`${t("saving")} ${t("workspace").toLowerCase()}...`}
                  helperLabel="All admin data stays scoped to this business."
                  switchErrorLabel="Failed to switch business"
                />
              </AdminSidebarSection>

            <div>
              {groupOwnerNav(adminNav).map((group) => (
                <AdminSidebarSection
                  key={group.label}
                  title={translateAdminLabel(activeBusiness?.language, group.label)}
                >
                  <nav className="admin-sidebar-nav">
                    {group.items.map((item) => (
                      <AdminNavLink
                        key={item.href}
                        href={item.href}
                        active={currentPath === item.href}
                      >
                        {translateAdminLabel(activeBusiness?.language, item.label)}
                      </AdminNavLink>
                    ))}
                  </nav>
                </AdminSidebarSection>
              ))}
            </div>

            {!activeBusiness ? (
              <AdminPanel>Create or select a business to manage settings.</AdminPanel>
            ) : null}
          </div>

          <div className="admin-sidebar-footer" style={sidebarFooterStyle}>
            <AdminSidebarSection title="Utilities">
              <nav className="admin-sidebar-nav">
                <AdminNavLink href="/admin/settings" active={currentPath === "/admin/settings"}>
                  {t("settings")}
                </AdminNavLink>
                <AdminNavLink href="/admin/upgrade" active={currentPath === "/admin/upgrade"}>
                  {t("upgrade")}
                </AdminNavLink>
              </nav>
            </AdminSidebarSection>
          </div>
        </div>
      }
    >
      {!isCustomizeRoute ? (
        <AdminPageHeader
          eyebrow="Business Console"
          title={t("operationsConsole")}
          description="Manage the active business workspace."
          actions={
            <>
              <AdminActionLink href={businessModule.primaryAdminHref} tone="primary">
                {translateAdminLabel(activeBusiness?.language, businessModule.primaryAdminLabel)}
              </AdminActionLink>
              <AdminActionLink href="/admin/settings">{t("publishAndPayoutSettings")}</AdminActionLink>
            </>
          }
        />
      ) : null}

      {recovery && !recovery.readiness.canPublishLive && !isCustomizeRoute ? (
        <AdminPanel>
          <h2 className="admin-page-title">{recovery.readiness.label}</h2>
          <p className="admin-muted">{recovery.reason}</p>
          <p className="admin-muted">
            Completed {recovery.readiness.onboarding.completedCount} of{" "}
            {recovery.readiness.onboarding.totalCount} setup steps for{" "}
            {activeBusiness?.name || "this business"}.
          </p>
          <div className="admin-actions">
            <AdminActionLink href={recovery.href} tone="primary">{t("continueSetup")}</AdminActionLink>
          </div>
        </AdminPanel>
      ) : null}

      {children}
    </AdminShell>
  );
}
