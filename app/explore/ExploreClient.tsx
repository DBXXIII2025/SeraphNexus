"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import {
  buildBusinessViewModels,
  type Business,
  type BusinessViewModel,
  type PlatformSettings,
} from "./exploreData";
import ExploreGrid from "./_components/ExploreGrid";
import { resolvePlatformName } from "@/lib/platformBranding";
import { trackLeadEvents } from "@/lib/leadTracker";
import { SERVICE_CATEGORY_OPTIONS, type ServiceCategory } from "@/lib/serviceCategories";

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
  useEffect(() => {
    const syncCategory = () => {
      const requested = new URLSearchParams(window.location.search).get("category");
      setCategory(CATEGORY_PILLS.some((pill) => pill.id === requested) ? requested as MarketplaceCategory : "all");
    };
    syncCategory();
    window.addEventListener("popstate", syncCategory);
    return () => window.removeEventListener("popstate", syncCategory);
  }, []);
  const [serviceCategory, setServiceCategory] = useState<ServiceCategory | "all">("all");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const trackedPageViewRef = useRef(false);

  const businessViews = useMemo(() => buildBusinessViewModels(businesses), [businesses]);

  const filteredBusinesses = useMemo(() => {
    return businessViews.filter((business) => {
      const matchesCategory = matchesMarketplaceCategory(business, category);
      const matchesSearch =
        !deferredSearch || business.displayName.toLowerCase().includes(deferredSearch);
      const matchesServiceCategory =
        category !== "services" ||
        serviceCategory === "all" ||
        (business.normalizedType === "service" && business.service_category === serviceCategory);

      return matchesCategory && matchesSearch && matchesServiceCategory;
    });
  }, [businessViews, category, deferredSearch, serviceCategory]);

  const categoryCounts = useMemo(() => {
    return CATEGORY_PILLS.reduce<Record<MarketplaceCategory, number>>((acc, pill) => {
      acc[pill.id] = businessViews.filter((business) =>
        matchesMarketplaceCategory(business, pill.id)
      ).length;
      return acc;
    }, {} as Record<MarketplaceCategory, number>);
  }, [businessViews]);

  const platformName = resolvePlatformName(settings);
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

  const categoryTitles: Record<MarketplaceCategory, string> = {
    all: "Find something worth discovering.",
    services: "Expert help, made simple.",
    rentals: "Your next getaway starts here.",
    food: "Something good is nearby.",
    shops: "Independent finds. Personal touches.",
  };
  return (
    <div className="sn-marketplace min-h-screen bg-[#f7f6f1] text-[#2a302b]">
      <div className="mx-auto max-w-7xl px-5 pb-20 pt-10 sm:px-8">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-[#e3e5d9] pb-6">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#8b7a42]">The Seraph Nexus marketplace</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">{platformName}</h1></div>
          <div className="flex flex-wrap items-center gap-2">
            <a href="/" className="rounded-full border border-[#dcded2] bg-white px-5 py-2 text-sm font-medium text-[#374139]">Home</a>
            <a href={isLoggedIn ? "/admin" : "/login"} className="rounded-full border border-[#dcded2] bg-white px-5 py-2 text-sm font-medium text-[#374139]">{isLoggedIn ? "Account" : "Log in"}</a>
            <a href={createBusinessHref} className="rounded-full bg-[#e5bc4f] px-5 py-2 text-sm font-semibold text-[#292e28]">Create a business</a>
          </div>
        </header>
        <section className="relative overflow-hidden rounded-[2rem] border border-[#e3e5d9] bg-[#edf1e8] px-6 py-12 text-center sm:px-12 sm:py-16">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-28 h-72 w-72 rounded-full bg-[#e7d994]/40 blur-3xl" />
          <p className="relative text-[11px] font-bold uppercase tracking-[0.28em] text-[#887840]">Discover local possibilities</p>
          <h2 className="relative mx-auto mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.045em] sm:text-6xl">{categoryTitles[category]}</h2>
          <p className="relative mx-auto mt-5 max-w-xl text-sm leading-7 text-[#69756b] sm:text-base">Explore trusted businesses, find your next favorite, and take the next step in one connected place.</p>
          <label className="sr-only" htmlFor="explore-search">Search businesses</label>
          <input id="explore-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search businesses by name…" className="relative mx-auto mt-8 block h-13 w-full max-w-xl rounded-full border border-[#d9ddd1] bg-white px-6 py-3 text-base text-[#28312a] outline-none focus:border-[#ad9145] focus:ring-2 focus:ring-[#eadbaf]" />
        </section>
        <nav aria-label="Marketplace categories" className="my-8 flex flex-wrap items-center justify-center gap-2">
          {CATEGORY_PILLS.map((pill) => (
            <button key={pill.id} type="button" aria-pressed={category === pill.id} onClick={() => { setCategory(pill.id); window.history.replaceState(null, "", pill.id === "all" ? "/explore" : `/explore?category=${pill.id}`); }} className={category === pill.id ? "rounded-full border border-[#d3b75f] bg-[#f0d778] px-5 py-2.5 text-sm font-semibold text-[#2b3029]" : "rounded-full border border-[#dde1d6] bg-white px-5 py-2.5 text-sm font-medium text-[#4c594e] transition hover:bg-[#e8eee4]"}>{pill.label} <span className="ml-1 text-xs opacity-70">{categoryCounts[pill.id]}</span></button>
          ))}
        </nav>
        {category === "services" ? <div className="mb-8 flex justify-center"><label className="text-sm font-medium text-[#536054]">Service type <select value={serviceCategory} onChange={(event) => setServiceCategory(event.target.value as ServiceCategory | "all")} className="ml-3 rounded-full border border-[#dce0d3] bg-white px-4 py-2 text-[#303a32]"><option value="all">All services</option>{SERVICE_CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div> : null}
        <section aria-label="Marketplace results">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-2"><div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a18b49]">Explore the collection</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">{filteredBusinesses.length} {filteredBusinesses.length === 1 ? "business" : "businesses"} to explore</h2></div><p className="text-sm text-[#778076]">Find, connect, book and shop.</p></div>
          {filteredBusinesses.length === 0 ? <div className="rounded-3xl border border-[#e4e6dc] bg-white px-6 py-16 text-center text-[#687368]">No businesses match your search right now. Try another category or search term.</div> : <ExploreGrid businesses={filteredBusinesses} />}
        </section>
      </div>
    </div>
  );
}
