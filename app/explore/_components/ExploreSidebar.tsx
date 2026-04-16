"use client";

import {
  ExploreRouteFilterId,
  ROUTE_FILTERS,
  formatBusinessType,
} from "../exploreData";

export default function ExploreSidebar({
  typeFilter,
  routeFilter,
  statusFilter,
  visibleTypes,
  createBusinessHref,
  hasActiveFilters,
  onTypeChange,
  onRouteChange,
  onStatusChange,
  onClear,
}: {
  typeFilter: string;
  routeFilter: ExploreRouteFilterId;
  statusFilter: "all" | "public-ready";
  visibleTypes: string[];
  createBusinessHref: string;
  hasActiveFilters: boolean;
  onTypeChange: (value: string) => void;
  onRouteChange: (value: ExploreRouteFilterId) => void;
  onStatusChange: (value: "all" | "public-ready") => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-950">Filters</p>
            <p className="mt-1 text-xs text-slate-500">Refine what appears in the marketplace grid.</p>
          </div>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex min-h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-500"
            >
              Clear
            </button>
          ) : null}
        </div>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-medium text-slate-700">
              Business Type
            </span>
            <select value={typeFilter} onChange={(event) => onTypeChange(event.target.value)}>
              <option value="all">All business types</option>
              {visibleTypes.map((type) => (
                <option key={type} value={type}>
                  {formatBusinessType(type)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-medium text-slate-700">
              Route Type
            </span>
            <select value={routeFilter} onChange={(event) => onRouteChange(event.target.value as ExploreRouteFilterId)}>
              {ROUTE_FILTERS.map((filter) => (
                <option key={filter.id} value={filter.id}>
                  {filter.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-medium text-slate-700">
              Status
            </span>
            <select
              value={statusFilter}
              onChange={(event) => onStatusChange(event.target.value as "all" | "public-ready")}
            >
              <option value="all">All</option>
              <option value="public-ready">Public-ready</option>
            </select>
          </label>
        </div>
      </section>

      <a
        href={createBusinessHref}
        className="btn-primary inline-flex min-h-11 w-full items-center justify-center px-4 py-2 text-sm font-semibold"
      >
        Create Business
      </a>
    </div>
  );
}
