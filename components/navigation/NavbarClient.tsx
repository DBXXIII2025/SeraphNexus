"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import PlatformBrandMark from "@/components/branding/PlatformBrandMark";

type NavbarClientProps = {
  isLoggedIn: boolean;
  isPlatformAdmin: boolean;
  siteName: string;
  logoUrl?: string | null;
};

type NavLinkItem = {
  href: string;
  label: string;
  emphasis?: "primary" | "secondary" | "ghost";
};

const HIDDEN_PREFIXES = [
  "/admin",
  "/dashboard",
  "/platform-admin",
  "/explore",
  "/auth",
];
const HIDDEN_EXACT_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
];

function isHiddenPath(pathname: string) {
  if (HIDDEN_EXACT_PATHS.includes(pathname)) {
    return true;
  }

  return HIDDEN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function getLinkClass(
  emphasis: NavLinkItem["emphasis"],
  active: boolean
) {
  if (emphasis === "primary") {
    return "inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-contrast)] shadow-[var(--shadow-soft)]";
  }

  if (emphasis === "secondary") {
    return `inline-flex min-h-11 items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium ${
      active
        ? "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--text-strong)]"
        : "border-[var(--border-soft)] bg-[var(--surface-raised)] text-[var(--text-strong)] hover:border-[var(--border-strong)] hover:bg-[var(--accent-muted)]"
    }`;
  }

  return `inline-flex min-h-11 items-center justify-center rounded-xl px-3 py-2 text-sm ${
    active
      ? "text-[var(--text-strong)]"
      : "text-[var(--text-soft)] hover:bg-[var(--accent-muted)] hover:text-[var(--accent-soft)]"
  }`;
}

export default function NavbarClient({
  isLoggedIn,
  isPlatformAdmin,
  siteName,
  logoUrl,
}: NavbarClientProps) {
  const pathname = usePathname();
  if (!pathname || isHiddenPath(pathname)) {
    return null;
  }

  const createBusinessHref = isLoggedIn
    ? "/onboarding/create-business"
    : "/login?next=/onboarding/create-business";
  const homeHref = "/";
  const exploreActive = pathname === "/explore" || pathname.startsWith("/b/");

  const primaryLinks: NavLinkItem[] = [
    { href: "/explore", label: "Marketplace", emphasis: "ghost" },
    { href: "/#features", label: "For businesses", emphasis: "ghost" },
    { href: "/pricing", label: "Pricing", emphasis: "ghost" },
  ];

  const actionLinks: NavLinkItem[] = isLoggedIn
    ? [
        ...(isPlatformAdmin
          ? []
          : [
              {
                href: createBusinessHref,
                label: "Create Business",
                emphasis: "primary" as const,
              },
            ]),
        {
          href: "/admin",
          label: isPlatformAdmin ? "Platform Admin" : "Admin",
          emphasis: "secondary" as const,
        },
      ]
    : [
        { href: "/login", label: "Login", emphasis: "secondary" as const },
        { href: "/signup", label: "Sign Up", emphasis: "secondary" as const },
        {
          href: createBusinessHref,
          label: "Create Business",
          emphasis: "primary" as const,
        },
      ];

  return (
    <div className="sticky top-0 z-50 border-b border-[var(--border-soft)] bg-[var(--section-bg)]">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href={homeHref}
          className="group inline-flex shrink-0 items-center gap-2 rounded-xl px-2 py-2"
        >
          <span className="site-brand-mark">
            <PlatformBrandMark
              src={logoUrl}
              alt={`${siteName} logo`}
              fallback="SN"
              logScope="global-header"
              imgClassName="site-brand-logo"
              fallbackClassName=""
            />
          </span>
          <span className="whitespace-nowrap text-base font-semibold tracking-tight text-[var(--text-strong)]">
            {siteName}
          </span>
        </Link>

        <nav aria-label="Main navigation" className="ml-2 hidden items-center gap-1 lg:flex"><details className="group relative">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-2 text-sm text-[var(--text-soft)] hover:bg-[var(--accent-muted)]">Discover <span aria-hidden="true">▾</span></summary>
            <div className="absolute left-0 top-full z-50 mt-2 grid min-w-52 gap-1 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-2 shadow-[var(--shadow-soft)]">
              <Link href="/explore?category=services" className={getLinkClass("ghost", exploreActive)}>Services</Link>
              <Link href="/explore?category=rentals" className={getLinkClass("ghost", false)}>Rentals</Link>
              <Link href="/explore?category=shops" className={getLinkClass("ghost", false)}>Shops</Link>
              <Link href="/explore?category=food" className={getLinkClass("ghost", false)}>Food &amp; drinks</Link>
              <Link href="/#features" className={getLinkClass("ghost", false)}>Platform features</Link>
              <Link href="/pricing" className={getLinkClass("ghost", pathname.startsWith("/pricing"))}>Plans & pricing</Link>
            </div>
          </details>
          {primaryLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={getLinkClass(
                item.emphasis,
                item.href === "/explore" ? exploreActive : pathname.startsWith(item.href)
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          {actionLinks.map((item) => (
            <Link
              key={item.href + item.label}
              href={item.href}
              className={getLinkClass(item.emphasis, pathname.startsWith(item.href))}
            >
              {item.label}
            </Link>
          ))}
        </div>

      </div>
      <nav aria-label="Mobile navigation" className="flex flex-wrap items-center justify-center gap-1 border-t border-[var(--border-soft)] px-3 py-2 lg:hidden">
        <Link href="/explore" className={getLinkClass("ghost", exploreActive)}>Marketplace</Link>
        <Link href="/#features" className={getLinkClass("ghost", false)}>For businesses</Link>
        <Link href="/pricing" className={getLinkClass("ghost", pathname.startsWith("/pricing"))}>Pricing</Link>
        {actionLinks.map((item) => (
          <Link key={item.href + item.label} href={item.href} className={getLinkClass(item.emphasis, pathname.startsWith(item.href))}>{item.label}</Link>
        ))}
      </nav>
    </div>
  );
}
