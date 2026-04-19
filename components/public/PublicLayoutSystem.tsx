import Link from "next/link";
import type { ReactNode } from "react";

export function PublicSiteShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`public-system ${className}`}>
      <div className="public-system-glow" />
      <div className="public-container">{children}</div>
    </div>
  );
}

export function PublicTopNav({
  brand,
  initials,
  logoUrl,
  actions,
}: {
  brand: string;
  initials: string;
  logoUrl?: string | null;
  actions?: ReactNode;
}) {
  return (
    <header className="public-topnav">
      <Link href="/explore" className="public-brand">
        <span className="public-brand-mark">
          {logoUrl ? (
            <img src={logoUrl} alt={`${brand} logo`} className="public-brand-logo" />
          ) : (
            initials
          )}
        </span>
        <span>{brand}</span>
      </Link>
      {actions ? <nav className="public-actions">{actions}</nav> : null}
    </header>
  );
}

export function PublicHero({
  eyebrow,
  title,
  description,
  actions,
  meta,
}: {
  eyebrow?: string;
  title: string;
  description?: string | null;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <section className="public-hero">
      <div>
        {eyebrow ? <p className="public-eyebrow">{eyebrow}</p> : null}
        <h1 className="public-hero-title">{title}</h1>
        {description ? <p className="public-muted public-hero-copy">{description}</p> : null}
        {meta ? <div className="public-meta-row">{meta}</div> : null}
      </div>
      {actions ? <div className="public-actions">{actions}</div> : null}
    </section>
  );
}

export function PublicSection({
  children,
  title,
  eyebrow,
  description,
  actions,
  className = "",
}: {
  children: ReactNode;
  title?: string;
  eyebrow?: string;
  description?: string | null;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`public-section ${className}`}>
      {title || eyebrow || description || actions ? (
        <div className="public-section-header">
          <div>
            {eyebrow ? <p className="public-eyebrow">{eyebrow}</p> : null}
            {title ? <h2 className="public-section-title">{title}</h2> : null}
            {description ? <p className="public-muted">{description}</p> : null}
          </div>
          {actions ? <div className="public-actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function PublicCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <article className={`public-card ${className}`}>{children}</article>;
}

export function PublicActionLink({
  href,
  children,
  tone = "secondary",
  onClick,
}: {
  href: string;
  children: ReactNode;
  tone?: "primary" | "secondary";
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={tone === "primary" ? "public-action-primary" : "public-action-secondary"}
    >
      {children}
    </Link>
  );
}

export function PublicEmptyState({ children }: { children: ReactNode }) {
  return <div className="public-empty-state">{children}</div>;
}
