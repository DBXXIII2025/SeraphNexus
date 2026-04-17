import Link from "next/link";
import { ReactNode } from "react";
import { headers } from "next/headers";
import { getUserBusinesses } from "@/lib/getBusinesses";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { getAdminNav, getBusinessModule, getPublicPath } from "@/lib/businessModules";
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

function PlainNavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="block border p-2">
      {children}
    </Link>
  );
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
    });
  }

  if (isPlatformAdmin) {
    return (
      <div className="min-h-screen">
        <div className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[260px,1fr]">
          <aside className="border p-3">
            <div className="space-y-4">
              <section className="border p-3">
                <p>Platform Owner</p>
                <h1>{user?.email || "Platform owner"}</h1>
                <p>Platform operations and support.</p>
              </section>

              <nav className="space-y-2">
                <p>Platform Navigation</p>
                {PLATFORM_OWNER_NAV.map((item) => (
                  <PlainNavLink key={item.href} href={item.href}>
                    {item.label}
                  </PlainNavLink>
                ))}
              </nav>

              <section className="border p-3">
                <p>Tenant isolation</p>
                <p>Business creation and workspace switching are hidden for this account.</p>
              </section>

              <LogoutButton />
            </div>
          </aside>

          <main className="min-w-0 space-y-4">
            <section className="border p-3">
              <h2>Platform Operations</h2>
              <p>Operate Seraph Nexus from the admin console.</p>
            </section>
            {children}
          </main>
        </div>
      </div>
    );
  }

  if (isCustomizeRoute) {
    return (
      <div className="min-h-screen">
        <header className="border-b p-4">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p>Business website builder</p>
              <h1>{activeBusiness?.name || "Business profile"}</h1>
            </div>
            <nav className="flex flex-wrap gap-2">
              <Link href="/admin">Admin</Link>
              <Link href="/admin/settings">Settings</Link>
              {activeBusiness?.slug ? (
                <Link href={getPublicPath(activeBusiness.business_type, activeBusiness.slug)}>
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
    <div className="min-h-screen">
      <div className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[260px,1fr]">
        <aside className="border p-3">
          <div className="space-y-4">
            <section className="border p-3">
              <p>{t("ownerWorkspace")}</p>
              <h1>{activeBusiness?.name || t("noActiveBusiness")}</h1>
              <p>{businessModule.label} operations.</p>
              {activeBusiness ? (
                <div className="mt-3 grid gap-2">
                  <Link href={businessModule.primaryAdminHref}>
                    {t("open")}{" "}
                    {translateAdminLabel(activeBusiness.language, businessModule.primaryAdminLabel)}
                  </Link>
                  {activeBusiness.slug ? (
                    <Link href={getPublicPath(activeBusiness.business_type, activeBusiness.slug)}>
                      {t("openPublicPage")}
                    </Link>
                  ) : (
                    <Link href="/admin/settings">{t("publishAndPayoutSettings")}</Link>
                  )}
                </div>
              ) : null}
            </section>

            <section className="border p-3">
              <p>{t("workspaceScope")}</p>
              <BusinessSwitcher
                businesses={switcherBusinesses}
                activeBusinessId={activeBusiness?.id}
              />
            </section>

            <div>
              {groupOwnerNav(adminNav).map((group) => (
                <nav key={group.label} className="mb-4 space-y-2">
                  <p>{translateAdminLabel(activeBusiness?.language, group.label)}</p>
                  {group.items.map((item) => (
                    <PlainNavLink key={item.href} href={item.href}>
                      {translateAdminLabel(activeBusiness?.language, item.label)}
                    </PlainNavLink>
                  ))}
                </nav>
              ))}
            </div>

            {!activeBusiness ? (
              <section className="border p-3">Create or select a business to manage settings.</section>
            ) : null}

            <LogoutButton />
          </div>
        </aside>

        <main className="min-w-0 space-y-4">
          {!isCustomizeRoute ? (
            <section className="border p-3">
              <h2>{t("operationsConsole")}</h2>
              <p>Manage the active business workspace.</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link href={businessModule.primaryAdminHref}>
                  {translateAdminLabel(activeBusiness?.language, businessModule.primaryAdminLabel)}
                </Link>
                <Link href="/admin/settings">{t("publishAndPayoutSettings")}</Link>
              </div>
            </section>
          ) : null}

          {recovery && !recovery.readiness.canPublishLive && !isCustomizeRoute ? (
            <section className="border p-3">
              <h2>{recovery.readiness.label}</h2>
              <p>{recovery.reason}</p>
              <p>
                Completed {recovery.readiness.onboarding.completedCount} of{" "}
                {recovery.readiness.onboarding.totalCount} setup steps for{" "}
                {activeBusiness?.name || "this business"}.
              </p>
              <Link href={recovery.href}>{t("continueSetup")}</Link>
            </section>
          ) : null}

          {children}
        </main>
      </div>
    </div>
  );
}
