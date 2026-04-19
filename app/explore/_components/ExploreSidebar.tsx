"use client";

import {
  ExploreRouteFilterId,
  ROUTE_FILTERS,
  formatBusinessType,
} from "../exploreData";
import {
  PublicActionLink,
  PublicSection,
} from "@/components/public/PublicLayoutSystem";

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
      <PublicSection
        eyebrow="Filters"
        title="Refine results"
        description="Control the marketplace grid by type, route, and readiness."
        actions={
          hasActiveFilters ? (
            <button
              type="button"
              onClick={onClear}
              className="public-action-secondary"
            >
              Clear
            </button>
          ) : null
        }
      >
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-2 block">
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
            <span className="mb-2 block">
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
            <span className="mb-2 block">
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
      </PublicSection>

      <PublicActionLink href={createBusinessHref} tone="primary">
        Create Business
      </PublicActionLink>
    </div>
  );
}
