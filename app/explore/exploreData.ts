import { getPublicBusinessHrefState } from "@/lib/publicBusinessRoutes";
import { normalizeBusinessPlan } from "@/lib/planConfig";

export type Business = {
  id: string;
  name: string | null;
  slug: string | null;
  description?: string | null;
  business_type: string | null;
  is_published: boolean | null;
  created_at?: string | null;
  plan?: string | null;
};

export type PlatformSettings = {
  platform_name: string;
  marketing_headline: string;
  marketing_subheadline: string;
  support_email: string;
  support_phone: string;
  pricing_note: string;
};

export type ExploreCategoryId =
  | "all"
  | "services"
  | "food"
  | "rentals"
  | "products"
  | "creators";

export type ExploreCategory = {
  id: Exclude<ExploreCategoryId, "all">;
  label: string;
  shortLabel: string;
  description: string;
  strapline: string;
  tone: string;
};

export type ExploreRouteFilterId = "all" | "book" | "order" | "rent" | "shop" | "b";

export type BusinessViewModel = Business & {
  normalizedType: string;
  categoryId: Exclude<ExploreCategoryId, "all">;
  routeState: ReturnType<typeof getPublicBusinessHrefState>;
  routeLabel: string;
  routeSummary: string;
  displayName: string;
  displayDescription: string;
  initials: string;
  score: number;
};

export const EXPLORE_CATEGORIES: ExploreCategory[] = [
  {
    id: "services",
    label: "Services",
    shortLabel: "Service",
    description: "Appointments, consulting, and service-led operators positioned for direct conversion.",
    strapline: "Client-ready booking businesses",
    tone: "from-[rgba(212,175,55,0.22)] via-[rgba(212,175,55,0.08)] to-transparent",
  },
  {
    id: "food",
    label: "Restaurants / Food",
    shortLabel: "Food",
    description: "Dining, menus, delivery, and food-led storefronts built for immediate ordering.",
    strapline: "Order-first hospitality",
    tone: "from-[rgba(193,18,31,0.24)] via-[rgba(193,18,31,0.08)] to-transparent",
  },
  {
    id: "rentals",
    label: "Rentals / Properties",
    shortLabel: "Rentals",
    description: "Reservation-led property and rental inventory presented with a more premium browse flow.",
    strapline: "Reservation-driven inventory",
    tone: "from-[rgba(232,204,106,0.2)] via-[rgba(232,204,106,0.08)] to-transparent",
  },
  {
    id: "products",
    label: "Products / Store",
    shortLabel: "Store",
    description: "Retail and product-focused storefronts organized for stronger catalog discoverability.",
    strapline: "Commerce storefronts",
    tone: "from-[rgba(245,245,245,0.16)] via-[rgba(245,245,245,0.06)] to-transparent",
  },
  {
    id: "creators",
    label: "Creators / Other",
    shortLabel: "Creators",
    description: "Independent brands and public profiles that sit outside the standard commerce lanes.",
    strapline: "Profiles and creator-led brands",
    tone: "from-[rgba(143,12,21,0.26)] via-[rgba(143,12,21,0.09)] to-transparent",
  },
];

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

export function normalizeBusinessType(type: string | null | undefined) {
  return String(type || "").trim().toLowerCase();
}

export function getExploreCategoryId(
  businessType: string | null | undefined
): Exclude<ExploreCategoryId, "all"> {
  const normalizedType = normalizeBusinessType(businessType);

  if (normalizedType === "service") {
    return "services";
  }

  if (normalizedType === "restaurant" || normalizedType === "food") {
    return "food";
  }

  if (normalizedType === "rental" || normalizedType === "property") {
    return "rentals";
  }

  if (normalizedType === "store" || normalizedType === "product") {
    return "products";
  }

  return "creators";
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

export function getCategoryMeta(categoryId: Exclude<ExploreCategoryId, "all">) {
  return EXPLORE_CATEGORIES.find((category) => category.id === categoryId) || EXPLORE_CATEGORIES[0];
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
      const displayDescription =
        business.description?.trim() ||
        "Published on Seraph Nexus with a live public destination ready for discovery.";

      const viewModel: BusinessViewModel = {
        ...business,
        normalizedType,
        categoryId: getExploreCategoryId(normalizedType),
        routeState,
        routeLabel: formatRouteLabel(routeState.routeId),
        routeSummary: formatRouteSummary(routeState.routeId),
        displayName,
        displayDescription,
        initials: getInitials(displayName),
        score: 0,
      };

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

  if (categoryFilter !== "all") {
    parts.push(getCategoryMeta(categoryFilter).label);
  }

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
