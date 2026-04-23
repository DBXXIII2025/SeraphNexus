import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { resolvePlatformLogoUrl, resolvePlatformName } from "@/lib/platformBranding";
import { getPlatformSettings } from "@/lib/platformSettings";
import AdminNotificationBell from "@/components/notifications/AdminNotificationBell";
import {
  AdminActionLink,
  AdminNavLink,
  AdminShell,
  AdminSidebarBrand,
  AdminSidebarSection,
  AdminTopNav,
} from "@/components/admin/AdminLayoutSystem";

const DASHBOARD_NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/bookings", label: "Transactions" },
  { href: "/dashboard/services", label: "Services" },
  { href: "/dashboard/settings", label: "Settings" },
  { href: "/dashboard/upgrade", label: "Upgrade" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const currentPath = requestHeaders.get("x-current-path") || "";
  const supabase = await createClient();
  const settings = await getPlatformSettings();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <AdminShell
      topbar={
        <AdminTopNav
          eyebrow="Legacy Workspace"
          title="Dashboard"
          description="Shared operating shell for legacy dashboard routes."
          actions={
            <>
              {user?.id ? <AdminNotificationBell userId={user.id} /> : null}
              <AdminActionLink href="/admin" tone="primary">
                Open Admin
              </AdminActionLink>
            </>
          }
        />
      }
      sidebar={
        <div className="admin-sidebar-stack">
          <AdminSidebarBrand
            brandName={resolvePlatformName(settings)}
            brandLogoUrl={resolvePlatformLogoUrl(settings)}
            eyebrow="Seraph Nexus"
            title="Legacy dashboard"
          />
          <AdminSidebarSection title="Workspace">
            <nav className="admin-sidebar-nav">
              {DASHBOARD_NAV.map((item) => (
                <AdminNavLink key={item.href} href={item.href} active={currentPath === item.href}>
                  {item.label}
                </AdminNavLink>
              ))}
            </nav>
          </AdminSidebarSection>
          <div className="admin-sidebar-fill" />
          <AdminSidebarSection title="Utilities">
            <nav className="admin-sidebar-nav">
              <AdminNavLink href="/explore" active={currentPath === "/explore"}>
                Explore
              </AdminNavLink>
              <AdminNavLink href="/admin" active={currentPath === "/admin"}>
                Admin Panel
              </AdminNavLink>
            </nav>
          </AdminSidebarSection>
        </div>
      }
    >
      {children}
    </AdminShell>
  );
}
