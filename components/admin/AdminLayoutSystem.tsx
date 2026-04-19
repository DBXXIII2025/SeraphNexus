import Link from "next/link";
import type { ReactNode } from "react";

export type AdminNavGroup = {
  label: string;
  items: Array<{ href: string; label: string }>;
};

export function AdminShell({
  children,
  sidebar,
  topbar,
  wide = false,
}: {
  children: ReactNode;
  sidebar?: ReactNode;
  topbar: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="admin-system min-h-screen">
      <div className="admin-system-glow" />
      <div className="admin-system-layout">
        {topbar}
        <div
          className={
            sidebar
              ? "admin-system-grid"
              : wide
                ? "admin-system-main admin-system-main-wide"
                : "admin-system-main"
          }
        >
          {sidebar ? <aside className="admin-system-sidebar">{sidebar}</aside> : null}
          <main className={sidebar ? "admin-system-content" : undefined}>{children}</main>
        </div>
      </div>
    </div>
  );
}

export function AdminTopNav({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="admin-topnav">
      <div>
        <p className="admin-eyebrow">{eyebrow}</p>
        <h1 className="admin-topnav-title">{title}</h1>
        {description ? <p className="admin-muted">{description}</p> : null}
      </div>
      {actions ? <div className="admin-actions">{actions}</div> : null}
    </header>
  );
}

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <section className="admin-page-header">
      <div>
        {eyebrow ? <p className="admin-eyebrow">{eyebrow}</p> : null}
        <h2 className="admin-page-title">{title}</h2>
        {description ? <p className="admin-muted">{description}</p> : null}
      </div>
      {actions ? <div className="admin-actions">{actions}</div> : null}
    </section>
  );
}

export function AdminPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`admin-panel ${className}`}>{children}</section>;
}

export function AdminSidebarSection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="admin-sidebar-section">
      {title ? <p className="admin-sidebar-title">{title}</p> : null}
      {children}
    </section>
  );
}

export function AdminNavLink({
  href,
  children,
  active = false,
}: {
  href: string;
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <Link href={href} className={active ? "admin-nav-link admin-nav-link-active" : "admin-nav-link"}>
      {children}
    </Link>
  );
}

export function AdminActionLink({
  href,
  children,
  tone = "secondary",
}: {
  href: string;
  children: ReactNode;
  tone?: "primary" | "secondary";
}) {
  return (
    <Link href={href} className={tone === "primary" ? "admin-action-primary" : "admin-action-secondary"}>
      {children}
    </Link>
  );
}
