import type { StructuredIconName } from "@/components/icons/StructuredIcon";

export type ExploreCategoryId =
  | "services"
  | "rentals"
  | "food"
  | "creators"
  | "store";

export type ExploreCategory = {
  id: ExploreCategoryId;
  label: string;
  shortLabel: string;
  description: string;
  strapline: string;
  tone: string;
  iconName: StructuredIconName;
};

const BUSINESS_TYPE_ALIASES: Record<string, string> = {
  appointment: "service",
  appointments: "service",
  booking: "service",
  bookings: "service",
  consultant: "service",
  consulting: "service",
  services: "service",
  dining: "restaurant",
  food_order: "restaurant",
  food_service: "restaurant",
  hospitality: "restaurant",
  menu: "restaurant",
  menus: "restaurant",
  order: "restaurant",
  restaurant: "restaurant",
  restaurants: "restaurant",
  properties: "property",
  property_rental: "property",
  rental_property: "property",
  rentals: "rental",
  commerce: "store",
  ecommerce: "store",
  e_commerce: "store",
  product: "product",
  products: "product",
  retail: "store",
  shop: "store",
  shops: "store",
  stores: "store",
  creator: "creator",
  creators: "creator",
  profile: "creator",
};

export const EXPLORE_CATEGORIES: ExploreCategory[] = [
  {
    id: "services",
    label: "Services",
    shortLabel: "Services",
    description: "Appointments, consulting, and service-led operators positioned for direct conversion.",
    strapline: "Client-ready booking businesses",
    tone: "from-transparent via-transparent to-transparent",
    iconName: "service",
  },
  {
    id: "rentals",
    label: "Rentals",
    shortLabel: "Rentals",
    description: "Reservation-led property and rental inventory presented with a premium browse flow.",
    strapline: "Reservation-driven inventory",
    tone: "from-transparent via-transparent to-transparent",
    iconName: "property",
  },
  {
    id: "food",
    label: "Food",
    shortLabel: "Food",
    description: "Dining, menus, delivery, and food-led storefronts built for immediate ordering.",
    strapline: "Order-first hospitality",
    tone: "from-transparent via-transparent to-transparent",
    iconName: "food",
  },
  {
    id: "creators",
    label: "Creators",
    shortLabel: "Creators",
    description: "Independent brands and public profiles that sit outside the standard commerce lanes.",
    strapline: "Profiles and creator-led brands",
    tone: "from-transparent via-transparent to-transparent",
    iconName: "creator",
  },
  {
    id: "store",
    label: "Store",
    shortLabel: "Store",
    description: "Retail and product-focused storefronts organized for stronger catalog discoverability.",
    strapline: "Commerce storefronts",
    tone: "from-transparent via-transparent to-transparent",
    iconName: "store",
  },
];

export function normalizeExploreBusinessType(type: string | null | undefined) {
  const normalized = String(type || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  return BUSINESS_TYPE_ALIASES[normalized] || normalized;
}

export function getExploreCategoryIdFromBusinessType(
  businessType: string | null | undefined
): ExploreCategoryId {
  const normalizedType = normalizeExploreBusinessType(businessType);

  if (normalizedType === "restaurant" || normalizedType === "food") {
    return "food";
  }

  if (normalizedType === "rental" || normalizedType === "property") {
    return "rentals";
  }

  if (normalizedType === "creator") {
    return "creators";
  }

  if (normalizedType === "store" || normalizedType === "product") {
    return "store";
  }

  return "services";
}

export function getExploreCategoryMeta(categoryId: ExploreCategoryId) {
  return EXPLORE_CATEGORIES.find((category) => category.id === categoryId) || EXPLORE_CATEGORIES[0];
}

export function getExploreBusinessIconName(
  businessType: string | null | undefined
): StructuredIconName {
  return getExploreCategoryMeta(getExploreCategoryIdFromBusinessType(businessType)).iconName;
}
