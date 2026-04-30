"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  PublicActionLink,
  PublicSiteShell,
  PublicTopNav,
  PublicEmptyState,
} from "@/components/public/PublicLayoutSystem";
import {
  buildBusinessViewModels,
  type Business,
  type BusinessViewModel,
  type PlatformSettings,
} from "./exploreData";
import ExploreGrid from "./_components/ExploreGrid";
import { resolvePlatformLogoUrl, resolvePlatformName } from "@/lib/platformBranding";
import { trackLeadEvents } from "@/lib/leadTracker";

type MarketplaceCategory = "all" | "services" | "rentals" | "food" | "shops";

const CATEGORY_PILLS: Array<{
  id: MarketplaceCategory;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "services", label: "Services" },
  { id: "rentals", label: "Rentals" },
  { id: "food", label: "Food" },
  { id: "shops", label: "Shops" },
];

function matchesMarketplaceCategory(
  business: BusinessViewModel,
  category: MarketplaceCategory
) {
  if (category === "all") {
    return true;
  }

  if (category === "shops") {
    return business.categoryId === "store" || business.categoryId === "creators";
  }

  return business.categoryId === category;
}

export default function ExploreClient({
  businesses,
  isLoggedIn,
  settings,
}: {
  businesses: Business[];
  isLoggedIn: boolean;
  settings: PlatformSettings;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<MarketplaceCategory>("all");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const trackedPageViewRef = useRef(false);

  const businessViews = useMemo(() => buildBusinessViewModels(businesses), [businesses]);

  const filteredBusinesses = useMemo(() => {
    return businessViews.filter((business) => {
      const matchesCategory = matchesMarketplaceCategory(business, category);
      const matchesSearch =
        !deferredSearch || business.displayName.toLowerCase().includes(deferredSearch);

      return matchesCategory && matchesSearch;
    });
  }, [businessViews, category, deferredSearch]);

  const categoryCounts = useMemo(() => {
    return CATEGORY_PILLS.reduce<Record<MarketplaceCategory, number>>((acc, pill) => {
      acc[pill.id] = businessViews.filter((business) =>
        matchesMarketplaceCategory(business, pill.id)
      ).length;
      return acc;
    }, {} as Record<MarketplaceCategory, number>);
  }, [businessViews]);

  const platformName = resolvePlatformName(settings);
  const platformLogoUrl = resolvePlatformLogoUrl(settings);
  const platformInitials =
    platformName
      .split(/\s+/)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("")
      .slice(0, 2) || "SN";

  const createBusinessHref = isLoggedIn
    ? "/onboarding/create-business"
    : "/login?next=/onboarding/create-business";

  useEffect(() => {
    if (trackedPageViewRef.current || businessViews.length === 0) {
      return;
    }

    trackedPageViewRef.current = true;

    void trackLeadEvents(
      businessViews.map((business) => ({
        businessId: business.id,
        eventType: "page_view",
        source: "explore",
        metadata: {
          page: "/explore",
          placement: "marketplace_grid",
        },
      }))
    );
  }, [businessViews]);

  return (
    <PublicSiteShell className="public-system-explore">
      <div className="space-y-4">
        <PublicTopNav
          brand={platformName}
          initials={platformInitials}
          logoUrl={platformLogoUrl}
          actions={
            <>
              <PublicActionLink href="/explore" tone="primary">
                Explore
              </PublicActionLink>
              <PublicActionLink href={isLoggedIn ? "/admin" : "/login"}>
                {isLoggedIn ? "Account" : "Login"}
              </PublicActionLink>
              <PublicActionLink href={createBusinessHref}>Create Business</PublicActionLink>
            </>
          }
        />

        <section className="rounded-[1.15rem] border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(22,25,30,0.98),rgba(17,19,23,0.98))] px-4 py-5 shadow-[0_18px_34px_rgba(0,0,0,0.34)] sm:px-6 sm:py-6">
          <div className="mx-auto max-w-4xl space-y-5 text-center">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-soft)]">
                Premium Marketplace
              </p>
              <h1 className="text-3xl font-semibold leading-tight text-[var(--text-strong)] sm:text-4xl">
                Explore businesses built for direct action.
              </h1>
              <p className="mx-auto max-w-2xl text-sm leading-6 text-[var(--text-soft)] sm:text-[0.95rem]">
                Search by name, switch categories instantly, and jump straight into booking,
                renting, ordering, or shopping.
              </p>
            </div>

            <div className="mx-auto w-full max-w-2xl">
              <label className="sr-only" htmlFor="explore-search">
                Search businesses
              </label>
              <input
                id="explore-search"
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search business name"
                className="h-12 w-full rounded-full border border-[rgba(212,175,55,0.18)] bg-[rgba(255,255,255,0.02)] px-5 text-center text-[0.96rem] text-[var(--text-strong)] outline-none transition focus:border-[rgba(212,175,55,0.32)] focus:shadow-[0_0_0_3px_rgba(212,175,55,0.12)]"
              />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              {CATEGORY_PILLS.map((pill) => {
                const active = category === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setCategory(pill.id)}
                    className={
                      active
                        ? "inline-flex min-h-[38px] items-center gap-2 rounded-full border border-[rgba(212,175,55,0.32)] bg-[linear-gradient(180deg,rgba(212,175,55,0.18),rgba(176,137,104,0.12))] px-4 text-sm font-semibold text-[var(--text-strong)]"
                        : "inline-flex min-h-[38px] items-center gap-2 rounded-full border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-4 text-sm font-semibold text-[var(--text-soft)] hover:border-[rgba(212,175,55,0.18)] hover:text-[var(--text-strong)]"
                    }
                  >
                    <span>{pill.label}</span>
                    <span className="rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(0,0,0,0.16)] px-1.5 py-0.5 text-[11px] text-[var(--text-muted)]">
                      {categoryCounts[pill.id]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-strong)]">
                {filteredBusinesses.length} results
              </h2>
              <p className="text-sm text-[var(--text-soft)]">
                Compact marketplace discovery with direct business actions.
              </p>
            </div>
          </div>

          {filteredBusinesses.length === 0 ? (
            <PublicEmptyState>
              <p>No businesses match this search right now.</p>
            </PublicEmptyState>
          ) : (
            <ExploreGrid businesses={filteredBusinesses} />
          )}
        </section>
      </div>
    </PublicSiteShell>
  );
}
