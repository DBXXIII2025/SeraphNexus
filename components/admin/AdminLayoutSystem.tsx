import Link from "next/link";
import type { ReactNode, SVGProps } from "react";
import PlatformBrandMark from "@/components/branding/PlatformBrandMark";
import LegalBrandingNotice from "@/components/legal/LegalBrandingNotice";

type AdminGlyphName =
  | "overview"
  | "businesses"
  | "calendar"
  | "messages"
  | "assistant"
  | "revenue"
  | "control"
  | "analytics"
  | "settings"
  | "leads"
  | "payments"
  | "services"
  | "products"
  | "support"
  | "upgrade";

function inferGlyphName(href: string, label: string): AdminGlyphName {
  const normalized = `${href} ${label}`.toLowerCase();

  if (normalized.includes("business")) return "businesses";
  if (normalized.includes("assistant") || normalized.includes("seravelle")) return "assistant";
  if (
    normalized.includes("calendar") ||
    normalized.includes("availability") ||
    normalized.includes("rental") ||
    normalized.includes("listing")
  ) {
    return "calendar";
  }
  if (
    normalized.includes("message") ||
    normalized.includes("support") ||
    normalized.includes("broadcast") ||
    normalized.includes("notification")
  ) {
    return "messages";
  }
  if (normalized.includes("revenue")) return "revenue";
  if (normalized.includes("platform")) return "control";
  if (normalized.includes("analytic")) return "analytics";
  if (normalized.includes("setting")) return "settings";
  if (normalized.includes("lead")) return "leads";
  if (normalized.includes("payment") || normalized.includes("payout")) return "payments";
  if (normalized.includes("service") || normalized.includes("booking")) return "services";
  if (normalized.includes("product") || normalized.includes("menu") || normalized.includes("order")) {
    return "products";
  }
  if (normalized.includes("upgrade")) return "upgrade";

  return "overview";
}

function AdminGlyph({
  name,
  className,
  ...props
}: SVGProps<SVGSVGElement> & { name: AdminGlyphName }) {
  const shared = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className,
    ...props,
  };

  switch (name) {
    case "businesses":
      return (
        <svg {...shared}>
          <path d="M4 20V6l4-2 4 2v14" />
          <path d="M12 20V10l4-2 4 2v10" />
          <path d="M8 9h.01M8 13h.01M16 13h.01M16 17h.01" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...shared}>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4M16 3v4M4 10h16" />
        </svg>
      );
    case "messages":
      return (
        <svg {...shared}>
          <path d="M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
        </svg>
      );
    case "assistant":
      return (
        <svg {...shared}>
          <rect x="5" y="6" width="14" height="12" rx="3" />
          <path d="M9 11h6" />
          <path d="M10 14h4" />
          <path d="M12 3v3M12 18v3M4 12H2m20 0h-2" />
        </svg>
      );
    case "revenue":
      return (
        <svg {...shared}>
          <path d="M5 19h14" />
          <path d="M7 16V9" />
          <path d="M12 16V5" />
          <path d="M17 16v-7" />
        </svg>
      );
    case "control":
      return (
        <svg {...shared}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.6Z" />
        </svg>
      );
    case "analytics":
      return (
        <svg {...shared}>
          <path d="M4 19h16" />
          <path d="M6 16 10 12l3 3 5-7" />
          <path d="M18 8h-4" />
        </svg>
      );
    case "settings":
      return (
        <svg {...shared}>
          <path d="M12 3v3M12 18v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M3 12h3M18 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
          <circle cx="12" cy="12" r="3.25" />
        </svg>
      );
    case "leads":
      return (
        <svg {...shared}>
          <path d="M7 18a4 4 0 1 1 3.9-4.8L20 4" />
          <path d="M14 4h6v6" />
        </svg>
      );
    case "payments":
      return (
        <svg {...shared}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M3 10h18" />
          <path d="M7 15h3" />
        </svg>
      );
    case "services":
      return (
        <svg {...shared}>
          <path d="M5 6h14" />
          <path d="M8 6v13" />
          <path d="M16 6v13" />
          <path d="M8 12h8" />
        </svg>
      );
    case "products":
      return (
        <svg {...shared}>
          <path d="M4 8h16l-1 12H5L4 8Z" />
          <path d="M8 8V6a4 4 0 0 1 8 0v2" />
        </svg>
      );
    case "support":
      return (
        <svg {...shared}>
          <circle cx="12" cy="12" r="8" />
          <path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-.8.8-1.7 1.3-1.7 2.7" />
          <path d="M12 17h.01" />
        </svg>
      );
    case "upgrade":
      return (
        <svg {...shared}>
          <path d="m12 4 6 7h-4v9h-4v-9H6l6-7Z" />
        </svg>
      );
    case "overview":
    default:
      return (
        <svg {...shared}>
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="4" rx="1.5" />
          <rect x="13" y="10" width="7" height="10" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
        </svg>
      );
  }
}

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
    <div className="admin-system text-[var(--text-main)]">
      <div className={sidebar ? "admin-shell-grid" : "admin-shell-grid admin-shell-grid-wide"}>
        {sidebar ? <aside className="admin-system-sidebar">{sidebar}</aside> : null}
        <div className="admin-shell-column">
          {topbar}
          <main
            className={
              sidebar
                ? "admin-system-content"
                : wide
                  ? "admin-system-content admin-system-content-wide"
                  : "admin-system-content"
            }
          >
            {children}
          </main>
          <footer className="admin-shell-footer">
            <LegalBrandingNotice compact />
          </footer>
        </div>
      </div>
    </div>
  );
}

export function AdminSidebarBrand({
  brandName,
  brandLogoUrl,
  eyebrow,
  title,
}: {
  brandName: string;
  brandLogoUrl?: string | null;
  eyebrow?: string;
  title: string;
}) {
  return (
    <div className="admin-sidebar-brand">
      <span className="admin-brand-mark">
        <PlatformBrandMark
          src={brandLogoUrl}
          alt={`${brandName} logo`}
          fallback="SN"
          logScope="admin-sidebar"
          imgClassName="admin-brand-logo"
        />
      </span>
      <div className="min-w-0">
        <p className="admin-brand-name">{brandName}</p>
        {eyebrow ? <p className="admin-sidebar-eyebrow">{eyebrow}</p> : null}
        <p className="admin-sidebar-heading">{title}</p>
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
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="admin-topnav">
      <div className="min-w-0">
        {eyebrow ? <p className="admin-eyebrow">{eyebrow}</p> : null}
        <div className="admin-topnav-copy">
          <h1 className="admin-topnav-title">{title}</h1>
          {description ? <p className="admin-muted">{description}</p> : null}
        </div>
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
      <div className="min-w-0">
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
  return <section className={`admin-panel ${className}`.trim()}>{children}</section>;
}

export function AdminPageContainer({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`admin-page-stack ${className}`.trim()}>{children}</div>;
}

export function DashboardSection({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`dashboard-section ${className}`.trim()}>{children}</section>;
}

export function DashboardGrid({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`dashboard-grid ${className}`.trim()}>{children}</div>;
}

export function DashboardPrimaryPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`dashboard-primary-panel ${className}`.trim()}>{children}</section>;
}

export function DashboardSecondaryPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`dashboard-secondary-panel ${className}`.trim()}>{children}</section>;
}

export function MetricCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`dashboard-metric-card ${className}`.trim()}>{children}</div>;
}

export function InfoCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`dashboard-info-card ${className}`.trim()}>{children}</div>;
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
  const label = typeof children === "string" ? children : "";
  const glyph = inferGlyphName(href, label);

  return (
    <Link href={href} className={active ? "admin-nav-link admin-nav-link-active" : "admin-nav-link"}>
      <span className="admin-nav-glyph">
        <AdminGlyph name={glyph} className="h-4 w-4" />
      </span>
      <span className="admin-nav-label">{children}</span>
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
