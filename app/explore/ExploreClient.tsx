"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import ExploreLayout from "./_components/ExploreLayout";
import ExploreSidebar from "./_components/ExploreSidebar";
import ExploreGrid from "./_components/ExploreGrid";
import ExploreCard from "./_components/ExploreCard";
import {
  buildBusinessViewModels,
  Business,
  ExploreCategoryId,
  ExploreRouteFilterId,
  EXPLORE_CATEGORIES,
  PlatformSettings,
} from "./exploreData";

export default function ExploreClient({
  businesses,
  isLoggedIn,
  isPlatformAdmin,
}: {
  businesses: Business[];
  isLoggedIn: boolean;
  isPlatformAdmin: boolean;
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

  const featuredBusinesses = useMemo(() => {
    return businessViews.filter((business) => business.routeState.isRoutable).slice(0, 3);
  }, [businessViews]);

  const createBusinessHref = isLoggedIn
    ? "/onboarding/create-business"
    : "/login?next=/onboarding/create-business";

  const accountHref = isPlatformAdmin ? "/platform-admin" : "/admin";
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
    <header className="rounded-[1.4rem] border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(28,22,22,0.96),rgba(17,14,14,0.98))] px-4 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.22)]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center">
          <div className="inline-flex items-center gap-3 rounded-2xl border border-[rgba(212,175,55,0.12)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,rgba(212,175,55,0.18),rgba(193,18,31,0.12))] text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent-gold-soft)]">
              SN
            </span>
            <span className="text-sm font-semibold text-[var(--text-strong)]">Seraph Nexus</span>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <Link
            href="/explore"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[rgba(212,175,55,0.14)] bg-[rgba(212,175,55,0.08)] px-4 py-2 text-sm font-semibold text-[var(--accent-gold-soft)]"
          >
            Explore
          </Link>

          <div ref={actionsMenuRef} className="relative">
            <button
              type="button"
              aria-expanded={actionsOpen}
              aria-haspopup="menu"
              onClick={() => setActionsOpen((value) => !value)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[rgba(23,19,19,0.82)] px-4 py-2 text-sm font-medium text-[var(--text-strong)] shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
            >
              <span>{isLoggedIn ? "Actions" : "Account"}</span>
              <span className="text-[10px] text-[var(--text-muted)]">{actionsOpen ? "Close" : "Open"}</span>
            </button>

            {actionsOpen ? (
              <div className="absolute right-0 top-full z-20 mt-3 w-[240px] rounded-[1.25rem] border border-[rgba(212,175,55,0.14)] bg-[linear-gradient(180deg,rgba(28,22,22,0.98),rgba(17,14,14,0.99))] p-3 shadow-[0_24px_44px_rgba(0,0,0,0.32)]">
                <div className="mb-3 px-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {isLoggedIn ? "Workspace Actions" : "Public Actions"}
                  </p>
                </div>

                <div className="grid gap-2">
                  {!isLoggedIn ? (
                    <>
                      <Link
                        href="/login"
                        onClick={() => setActionsOpen(false)}
                        className="btn-ghost justify-start px-4 py-2 text-sm font-medium"
                      >
                        Login
                      </Link>
                      <Link
                        href="/signup"
                        onClick={() => setActionsOpen(false)}
                        className="btn-secondary justify-start px-4 py-2 text-sm font-medium"
                      >
                        Sign Up
                      </Link>
                    </>
                  ) : (
                    <Link
                      href={accountHref}
                      onClick={() => setActionsOpen(false)}
                      className="btn-secondary justify-start px-4 py-2 text-sm font-medium"
                    >
                      My Account
                    </Link>
                  )}

                  <Link
                    href={createBusinessHref}
                    onClick={() => setActionsOpen(false)}
                    className="btn-primary justify-start px-4 py-2 text-sm font-medium"
                  >
                    Create Business
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );

  const controlBar = (
    <section className="rounded-[1.4rem] border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(28,22,22,0.96),rgba(17,14,14,0.98))] px-4 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.22)]">
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
            className={`rounded-full border px-3 py-2 text-xs font-semibold ${
              categoryFilter === "all"
                ? "border-[rgba(212,175,55,0.28)] bg-[rgba(212,175,55,0.14)] text-[var(--accent-gold-soft)] shadow-[inset_0_0_0_1px_rgba(212,175,55,0.08)]"
                : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-[var(--text-soft)] hover:border-[rgba(212,175,55,0.14)] hover:text-[var(--text-strong)]"
            }`}
          >
            All
          </button>
          {EXPLORE_CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setCategoryFilter(category.id)}
              className={`rounded-full border px-3 py-2 text-xs font-semibold ${
                categoryFilter === category.id
                  ? "border-[rgba(212,175,55,0.28)] bg-[rgba(212,175,55,0.14)] text-[var(--accent-gold-soft)] shadow-[inset_0_0_0_1px_rgba(212,175,55,0.08)]"
                  : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-[var(--text-soft)] hover:border-[rgba(212,175,55,0.14)] hover:text-[var(--text-strong)]"
              }`}
            >
              {category.shortLabel}
            </button>
          ))}
        </div>

        <select
          value={routeFilter}
          onChange={(event) => setRouteFilter(event.target.value as ExploreRouteFilterId)}
          aria-label="Sort dropdown"
        >
          <option value="all">Sort: Default</option>
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
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-sm font-medium text-[var(--text-soft)] transition hover:border-[rgba(212,175,55,0.14)] hover:text-[var(--text-strong)]"
          >
            Clear filters
          </button>
        </div>
      ) : null}
    </section>
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
    <div className="rounded-[1.4rem] border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(28,22,22,0.96),rgba(17,14,14,0.98))] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.22)]">
      <button
        type="button"
        onClick={() => setMobileFiltersOpen((value) => !value)}
        className="flex w-full items-center justify-between rounded-2xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-[var(--text-strong)]">Filters</span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          {mobileFiltersOpen ? "Close" : "Open"}
        </span>
      </button>
      {mobileFiltersOpen ? <div className="mt-4">{sidebar}</div> : null}
    </div>
  );

  const featured = featuredBusinesses.length > 0 ? (
    <section className="space-y-4">
      <div>
        <p className="section-kicker">Featured</p>
        <h2 className="mt-2 text-[1.35rem] font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
          Featured businesses
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {featuredBusinesses.map((business) => (
          <ExploreCard key={business.id} business={business} />
        ))}
      </div>
    </section>
  ) : null;

  const grid = (
    <section className="space-y-4">
      <div>
        <p className="section-kicker">Results</p>
        <h2 className="mt-2 text-[1.35rem] font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
          {sortedBusinesses.length} businesses
        </h2>
      </div>
      <ExploreGrid businesses={sortedBusinesses} />
    </section>
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
