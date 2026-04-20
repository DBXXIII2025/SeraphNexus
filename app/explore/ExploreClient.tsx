"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import ExploreLayout from "./_components/ExploreLayout";
import ExploreSidebar from "./_components/ExploreSidebar";
import ExploreGrid from "./_components/ExploreGrid";
import ExploreCard from "./_components/ExploreCard";
import {
  PublicActionLink,
  PublicHero,
  PublicSection,
  PublicTopNav,
} from "@/components/public/PublicLayoutSystem";
import {
  buildBusinessViewModels,
  Business,
  ExploreCategoryId,
  ExploreRouteFilterId,
  EXPLORE_CATEGORIES,
  PlatformSettings,
} from "./exploreData";
import { resolvePlatformLogoUrl, resolvePlatformName } from "@/lib/platformBranding";

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
  const [categoryFilter, setCategoryFilter] = useState<ExploreCategoryId>("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [routeFilter, setRouteFilter] = useState<ExploreRouteFilterId>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "public-ready">("all");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);

  const businessViews = useMemo(() => buildBusinessViewModels(businesses), [businesses]);

  const visibleTypes = useMemo(() => {
    const filtered = businessViews.filter((business) => {
      return categoryFilter === "all" || business.categoryId === categoryFilter;
    });

    return Array.from(new Set(filtered.map((business) => business.normalizedType).filter(Boolean))).sort();
  }, [businessViews, categoryFilter]);

  const sortedBusinesses = useMemo(() => {
    const filtered = businessViews.filter((business) => {
      const matchesSearch =
        !deferredSearch ||
        [
          business.displayName,
          business.displayDescription,
          business.normalizedType,
          business.routeLabel,
        ]
          .join(" ")
          .toLowerCase()
          .includes(deferredSearch);

      const matchesCategory =
        categoryFilter === "all" || business.categoryId === categoryFilter;
      const matchesType = typeFilter === "all" || business.normalizedType === typeFilter;
      const matchesRoute = routeFilter === "all" || business.routeState.routeId === routeFilter;
      const matchesStatus =
        statusFilter === "all" || business.routeState.isRoutable;

      return matchesSearch && matchesCategory && matchesType && matchesRoute && matchesStatus;
    });

    return filtered;
  }, [businessViews, categoryFilter, deferredSearch, routeFilter, statusFilter, typeFilter]);

  useEffect(() => {
    if (typeFilter !== "all" && !visibleTypes.includes(typeFilter)) {
      console.info("[explore] stale type filter reset", {
        categoryFilter,
        previousTypeFilter: typeFilter,
        visibleTypes,
      });
      setTypeFilter("all");
    }
  }, [categoryFilter, typeFilter, visibleTypes]);

  useEffect(() => {
    console.info("[explore] filter result counts", {
      search: deferredSearch,
      categoryFilter,
      typeFilter,
      routeFilter,
      statusFilter,
      resultCount: sortedBusinesses.length,
      totalCount: businessViews.length,
    });
  }, [
    businessViews.length,
    categoryFilter,
    deferredSearch,
    routeFilter,
    sortedBusinesses.length,
    statusFilter,
    typeFilter,
  ]);

  const featuredBusinesses = useMemo(() => {
    return businessViews.filter((business) => business.routeState.isRoutable).slice(0, 3);
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

  const accountHref = "/admin";
  const hasActiveFilters =
    Boolean(search.trim()) ||
    categoryFilter !== "all" ||
    typeFilter !== "all" ||
    routeFilter !== "all" ||
    statusFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setTypeFilter("all");
    setRouteFilter("all");
    setStatusFilter("all");
  };

  useEffect(() => {
    if (!actionsOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!actionsMenuRef.current?.contains(event.target as Node)) {
        setActionsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActionsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [actionsOpen]);

  const header = (
    <>
      <PublicTopNav
        brand={platformName}
        initials={platformInitials}
        logoUrl={platformLogoUrl}
        actions={
          <>
            <PublicActionLink href="/explore" tone="primary">Explore</PublicActionLink>

            <div ref={actionsMenuRef} className="relative">
              <button
                type="button"
                aria-expanded={actionsOpen}
                aria-haspopup="menu"
                onClick={() => setActionsOpen((value) => !value)}
                className="public-action-secondary gap-2"
              >
                <span>{isLoggedIn ? "Actions" : "Account"}</span>
                <span>{actionsOpen ? "Close" : "Open"}</span>
              </button>

            {actionsOpen ? (
              <div className="public-card absolute right-0 top-full z-20 mt-3 w-[240px] p-3">
                <div className="mb-3 px-2">
                  <p>
                    {isLoggedIn ? "Workspace Actions" : "Public Actions"}
                  </p>
                </div>

                <div className="grid gap-2">
                  {!isLoggedIn ? (
                    <>
                      <Link
                        href="/login"
                        onClick={() => setActionsOpen(false)}
                        className="public-action-secondary justify-start"
                      >
                        Login
                      </Link>
                      <Link
                        href="/signup"
                        onClick={() => setActionsOpen(false)}
                        className="public-action-secondary justify-start"
                      >
                        Sign Up
                      </Link>
                    </>
                  ) : (
                    <Link
                      href={accountHref}
                      onClick={() => setActionsOpen(false)}
                      className="public-action-secondary justify-start"
                    >
                      My Account
                    </Link>
                  )}

                  <Link
                    href={createBusinessHref}
                    onClick={() => setActionsOpen(false)}
                    className="public-action-primary justify-start"
                  >
                    Create Business
                  </Link>
                </div>
              </div>
            ) : null}
            </div>
          </>
        }
      />
      <PublicHero
        eyebrow="Business discovery"
        title="Find businesses ready for action."
        description={settings.marketing_subheadline || "Browse published businesses, then book, order, rent, shop, or message directly from their public page."}
        meta={
          <>
            <span className="public-chip">{businessViews.length} published</span>
            <span className="public-chip">{featuredBusinesses.length} featured</span>
          </>
        }
      />
    </>
  );

  const controlBar = (
    <PublicSection
      eyebrow="Browse"
      title="Search and filter"
      description="Use real public categories and customer action paths to narrow the marketplace."
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search businesses"
          className="input-field"
          aria-label="Search businesses"
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={categoryFilter === "all" ? "public-action-primary" : "public-action-secondary"}
          >
            All
          </button>
          {EXPLORE_CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setCategoryFilter(category.id)}
              className={categoryFilter === category.id ? "public-action-primary" : "public-action-secondary"}
            >
              {category.shortLabel}
            </button>
          ))}
        </div>

        <select
          value={routeFilter}
          onChange={(event) => setRouteFilter(event.target.value as ExploreRouteFilterId)}
          aria-label="Filter by customer action"
        >
          <option value="all">All actions</option>
          <option value="book">Book</option>
          <option value="order">Order</option>
          <option value="rent">Rent</option>
          <option value="shop">Shop</option>
          <option value="b">View</option>
        </select>
      </div>

      {hasActiveFilters ? (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={clearFilters}
            className="public-action-secondary"
          >
            Clear filters
          </button>
        </div>
      ) : null}
    </PublicSection>
  );

  const sidebar = (
    <ExploreSidebar
      typeFilter={typeFilter}
      routeFilter={routeFilter}
      statusFilter={statusFilter}
      visibleTypes={visibleTypes}
      createBusinessHref={createBusinessHref}
      onTypeChange={setTypeFilter}
        onRouteChange={setRouteFilter}
        onStatusChange={setStatusFilter}
        onClear={clearFilters}
        hasActiveFilters={hasActiveFilters}
      />
  );

  const mobileSidebar = (
    <PublicSection>
      <button
        type="button"
        onClick={() => setMobileFiltersOpen((value) => !value)}
        className="public-action-secondary flex w-full items-center justify-between text-left"
      >
        <span>Filters</span>
        <span>
          {mobileFiltersOpen ? "Close" : "Open"}
        </span>
      </button>
      {mobileFiltersOpen ? <div className="mt-4">{sidebar}</div> : null}
    </PublicSection>
  );

  const featured = featuredBusinesses.length > 0 ? (
    <PublicSection
      eyebrow="Featured"
      title="Featured businesses"
      description="Routable businesses with live customer paths."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {featuredBusinesses.map((business) => (
          <ExploreCard key={business.id} business={business} />
        ))}
      </div>
    </PublicSection>
  ) : null;

  const grid = (
    <PublicSection
      eyebrow="Results"
      title={`${sortedBusinesses.length} businesses`}
      description="Every card links to the business route currently available for that listing."
    >
      <ExploreGrid businesses={sortedBusinesses} />
    </PublicSection>
  );

  return (
    <ExploreLayout
      header={header}
      controlBar={controlBar}
      sidebar={sidebar}
      mobileSidebar={mobileSidebar}
      featured={featured}
      grid={grid}
    />
  );
}
