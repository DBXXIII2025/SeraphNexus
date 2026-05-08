import { getPublicBusinessHrefState } from "@/lib/publicBusinessRoutes";
import { normalizeBusinessPlan } from "@/lib/planConfig";
import type { StructuredIconName } from "@/components/icons/StructuredIcon";
import {
  EXPLORE_CATEGORIES,
  getExploreBusinessIconName,
  getExploreCategoryIdFromBusinessType,
  getExploreCategoryMeta,
  normalizeExploreBusinessType,
  type ExploreCategory,
  type ExploreCategoryId,
} from "@/lib/exploreBusinessTypes";
import { formatServiceCategory } from "@/lib/serviceCategories";

export { EXPLORE_CATEGORIES };
export type { ExploreCategory, ExploreCategoryId };

export type Business = {
  id: string;
  name: string | null;
  slug: string | null;
  description?: string | null;
  business_type: string | null;
  service_category?: string | null;
  is_published: boolean | null;
  created_at?: string | null;
  plan?: string | null;
  logo_url?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  service_area?: string | null;
};

export type PlatformSettings = {
  logo_url?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  platform_name: string;
  marketing_headline: string;
  marketing_subheadline: string;
  support_email: string;
  support_phone: string;
  pricing_note: string;
};

export type ExploreRouteFilterId = "all" | "book" | "order" | "rent" | "shop" | "b";

export type BusinessViewModel = Business & {
  normalizedType: string;
  categoryId: ExploreCategoryId;
  iconName: StructuredIconName;
  locationLabel: string;
  thumbnailUrl: string | null;
  routeState: ReturnType<typeof getPublicBusinessHrefState>;
  routeLabel: string;
  routeSummary: string;
  displayName: string;
  displayDescription: string | null;
  initials: string;
  score: number;
  serviceCategoryLabel: string | null;
};

export const ROUTE_FILTERS: Array<{
  id: ExploreRouteFilterId;
  label: string;
  summary: string;
}> = [
  { id: "all", label: "All", summary: "Every public route" },
  { id: "book", label: "Book", summary: "Services and appointments" },
  { id: "order", label: "Order", summary: "Food and menus" },
  { id: "rent", label: "Rent", summary: "Rental inventory" },
  { id: "shop", label: "Shop", summary: "Products and creators" },
  { id: "b", label: "View", summary: "Profile pages" },
];

export function formatBusinessType(type: string | null | undefined) {
  const value = String(type || "").trim();
  if (!value) {
    return "General";
  }

  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export const normalizeBusinessType = normalizeExploreBusinessType;

export function getExploreCategoryId(
  businessType: string | null | undefined
): ExploreCategoryId {
  return getExploreCategoryIdFromBusinessType(businessType);
}

export function getInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("")
      .slice(0, 2) || "SN"
  );
}

export function formatRouteLabel(routeId: string) {
  switch (routeId) {
    case "book":
      return "Book";
    case "order":
      return "Order";
    case "rent":
      return "Rent";
    case "shop":
      return "Shop";
    default:
      return "View";
  }
}

export function formatRouteSummary(routeId: string) {
  switch (routeId) {
    case "book":
      return "Direct appointment booking";
    case "order":
      return "Immediate ordering flow";
    case "rent":
      return "Reservation-ready rental flow";
    case "shop":
      return "Storefront and product browsing";
    default:
      return "Public profile destination";
  }
}

export function getCategoryMeta(categoryId: ExploreCategoryId) {
  return getExploreCategoryMeta(categoryId);
}

function cleanText(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function getBusinessLocationLabel(business: Business) {
  const cityState = [cleanText(business.city), cleanText(business.state)].filter(Boolean).join(", ");
  if (cityState) {
    return cityState;
  }

  const serviceArea = cleanText(business.service_area);
  if (serviceArea) {
    return serviceArea;
  }

  const address = cleanText(business.address);
  if (address) {
    return address;
  }

  const description = cleanText(business.description);
  if (description) {
    return description.length > 44 ? `${description.slice(0, 41).trimEnd()}...` : description;
  }

  return "Marketplace listing";
}

function getScore(business: BusinessViewModel) {
  let score = 0;

  if (business.routeState.isRoutable) score += 4;
  if (business.routeState.routeId !== "b") score += 3;
  if (business.description?.trim()) score += Math.min(4, Math.ceil(business.description.trim().length / 55));
  if (business.slug?.trim()) score += 1;
  if (normalizeBusinessPlan(business.plan) === "elite") score += 5;

  return score;
}

export function buildBusinessViewModels(businesses: Business[]) {
  return [...businesses]
    .map((business) => {
      const normalizedType = normalizeBusinessType(business.business_type);
      const routeState = getPublicBusinessHrefState({
        slug: business.slug,
        businessType: business.business_type,
      });
      const displayName = business.name?.trim() || "Unnamed business";
      const displayDescription = business.description?.trim() || null;
      const thumbnailUrl = cleanText(business.logo_url);
      const serviceCategoryLabel =
        normalizedType === "service" ? formatServiceCategory(business.service_category) : null;

      const viewModel: BusinessViewModel = {
        ...business,
        normalizedType,
        categoryId: getExploreCategoryId(normalizedType),
        iconName: getExploreBusinessIconName(normalizedType),
        locationLabel: getBusinessLocationLabel(business),
        thumbnailUrl,
        routeState,
        routeLabel: formatRouteLabel(routeState.routeId),
        routeSummary: formatRouteSummary(routeState.routeId),
        displayName,
        displayDescription,
        initials: getInitials(displayName),
        score: 0,
        serviceCategoryLabel,
      };

      console.info("[explore] business_type icon mapping", {
        businessId: business.id,
        businessType: business.business_type,
        normalizedType,
        categoryId: viewModel.categoryId,
        iconName: viewModel.iconName,
      });

      return {
        ...viewModel,
        score: getScore(viewModel),
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.displayName.localeCompare(right.displayName);
    });
}

export function getActiveFilterSummary({
  categoryFilter,
  typeFilter,
  routeFilter,
  search,
  routableOnly,
}: {
  categoryFilter: ExploreCategoryId;
  typeFilter: string;
  routeFilter: ExploreRouteFilterId;
  search: string;
  routableOnly: boolean;
}) {
  const parts: string[] = [];

  parts.push(getCategoryMeta(categoryFilter).label);

  if (typeFilter !== "all") {
    parts.push(formatBusinessType(typeFilter));
  }

  if (routeFilter !== "all") {
    parts.push(`Action: ${formatRouteLabel(routeFilter)}`);
  }

  if (routableOnly) {
    parts.push("Public-ready");
  }

  if (search.trim()) {
    parts.push(`Search: "${search.trim()}"`);
  }

  return parts.length > 0 ? parts.join(" / ") : "All published businesses";
}
