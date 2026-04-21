import type { StructuredIconName } from "@/components/icons/StructuredIcon";

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

function normalizeBusinessType(type: string | null | undefined) {
  const normalized = String(type || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  return BUSINESS_TYPE_ALIASES[normalized] || normalized;
}

export function getBusinessTypeIconName(
  businessType: string | null | undefined
): StructuredIconName {
  const normalizedType = normalizeBusinessType(businessType);

  if (normalizedType === "rental" || normalizedType === "property") {
    return "property";
  }

  if (normalizedType === "restaurant" || normalizedType === "food") {
    return "food";
  }

  if (normalizedType === "store" || normalizedType === "product") {
    return "store";
  }

  if (normalizedType === "creator") {
    return "creator";
  }

  return "service";
}
