"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type NavbarClientProps = {
  isLoggedIn: boolean;
  isPlatformAdmin: boolean;
};

type NavLinkItem = {
  href: string;
  label: string;
  emphasis?: "primary" | "secondary" | "ghost";
};

const HIDDEN_PREFIXES = ["/admin", "/dashboard", "/platform-admin", "/explore"];

function isHiddenPath(pathname: string) {
  return HIDDEN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function getLinkClass(
  emphasis: NavLinkItem["emphasis"],
  active: boolean
) {
  if (emphasis === "primary") {
    return "inline-flex min-h-11 items-center justify-center rounded-xl border border-[rgba(143,12,21,0.9)] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-4 py-2 text-sm font-semibold text-[var(--accent-contrast)] shadow-[0_16px_34px_rgba(193,18,31,0.22)]";
  }

  if (emphasis === "secondary") {
    return `inline-flex min-h-11 items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium ${
      active
        ? "border-[rgba(212,175,55,0.24)] bg-[rgba(212,175,55,0.08)] text-[var(--text-strong)]"
        : "border-[var(--border-soft)] bg-[rgba(23,19,19,0.82)] text-[var(--text-strong)] hover:border-[rgba(212,175,55,0.18)] hover:bg-[rgba(31,25,25,0.96)]"
    }`;
  }

  return `inline-flex min-h-11 items-center justify-center rounded-xl px-3 py-2 text-sm ${
    active
      ? "text-[var(--text-strong)]"
      : "text-[var(--text-soft)] hover:bg-[rgba(31,25,25,0.72)] hover:text-[var(--text-strong)]"
  }`;
}

export default function NavbarClient({
  isLoggedIn,
  isPlatformAdmin,
}: NavbarClientProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  if (!pathname || isHiddenPath(pathname)) {
    return null;
  }

  const createBusinessHref = isLoggedIn
    ? "/onboarding/create-business"
    : "/login?next=/onboarding/create-business";
  const homeHref = isLoggedIn ? "/admin" : "/";
  const exploreActive = pathname === "/explore" || pathname.startsWith("/b/");

  const primaryLinks: NavLinkItem[] = [
    { href: "/explore", label: "Explore", emphasis: "ghost" },
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
          href: isPlatformAdmin ? "/platform-admin" : "/admin",
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
    <div className="sticky top-0 z-50 border-b border-[rgba(212,175,55,0.08)] bg-[rgba(12,10,10,0.78)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href={homeHref}
          className="group inline-flex min-w-0 items-center gap-3 rounded-2xl border border-[rgba(212,175,55,0.12)] bg-[rgba(23,19,19,0.82)] px-3 py-2 pr-4"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,rgba(193,18,31,0.22),rgba(212,175,55,0.16))] text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent-gold-soft)]">
            SN
          </span>
          <span className="truncate text-sm font-semibold text-[var(--text-strong)]">
            Seraph Nexus
          </span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 lg:flex">
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

        <div className="ml-auto hidden items-center gap-2 md:flex">
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

        <button
          type="button"
          aria-label="Toggle site navigation"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((value) => !value)}
          className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[rgba(23,19,19,0.86)] text-[var(--text-strong)] md:hidden"
        >
          <span className="flex flex-col gap-1.5">
            <span className="block h-0.5 w-5 rounded bg-current" />
            <span className="block h-0.5 w-5 rounded bg-current" />
            <span className="block h-0.5 w-5 rounded bg-current" />
          </span>
        </button>
      </div>

      {mobileOpen ? (
        <div className="border-t border-[rgba(212,175,55,0.08)] bg-[rgba(12,10,10,0.94)] px-4 py-4 md:hidden">
          <div className="mx-auto max-w-7xl space-y-4">
            <div className="grid gap-2">
              {primaryLinks.map((item) => (
                <Link
                  key={`mobile-${item.href}`}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={getLinkClass(
                    "secondary",
                    item.href === "/explore" ? exploreActive : pathname.startsWith(item.href)
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="rounded-2xl border border-[rgba(212,175,55,0.12)] bg-[rgba(23,19,19,0.9)] p-3">
              <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--text-muted)]">
                Quick actions
              </p>
              <div className="mt-3 grid gap-2">
                {actionLinks.map((item) => (
                  <Link
                    key={`action-${item.href}-${item.label}`}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={getLinkClass(item.emphasis, pathname.startsWith(item.href))}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
