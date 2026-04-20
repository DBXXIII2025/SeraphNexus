export type PublicBusinessRouteId = "b" | "order" | "book" | "rent" | "shop";

export type CanonicalPublicBusinessRoute = {
  routeId: PublicBusinessRouteId;
  href: string;
  businessType: string | null;
};

export type PublicBusinessHrefState = CanonicalPublicBusinessRoute & {
  isRoutable: boolean;
  reason: string | null;
};

const PUBLIC_BUSINESS_TYPE_ROUTE_MAP: Record<string, PublicBusinessRouteId> = {
  service: "book",
  restaurant: "order",
  food: "order",
  rental: "rent",
  property: "rent",
  store: "shop",
  creator: "shop",
  product: "shop",
};

const PUBLIC_BUSINESS_TYPE_ALIASES: Record<string, string> = {
  appointment: "service",
  appointments: "service",
  booking: "service",
  bookings: "service",
  services: "service",
  dining: "restaurant",
  food_order: "restaurant",
  food_service: "restaurant",
  hospitality: "restaurant",
  menu: "restaurant",
  menus: "restaurant",
  order: "restaurant",
  restaurants: "restaurant",
  properties: "property",
  property_rental: "property",
  rental_property: "property",
  rentals: "rental",
  commerce: "store",
  ecommerce: "store",
  e_commerce: "store",
  products: "product",
  retail: "store",
  shop: "store",
  shops: "store",
  stores: "store",
  creators: "creator",
  profile: "creator",
};

function normalizeBusinessType(value: string | null | undefined) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  return PUBLIC_BUSINESS_TYPE_ALIASES[normalized] || normalized || null;
}

export function getPublicBusinessRouteId(
  businessType: string | null | undefined
): PublicBusinessRouteId {
  const normalized = normalizeBusinessType(businessType);
  if (!normalized) {
    return "b";
  }

  return PUBLIC_BUSINESS_TYPE_ROUTE_MAP[normalized] || "b";
}

export function getCanonicalPublicBusinessRoute(
  businessType: string | null | undefined,
  slug: string
): CanonicalPublicBusinessRoute {
  const routeId = getPublicBusinessRouteId(businessType);

  switch (routeId) {
    case "book":
      return { routeId, href: `/book/${slug}`, businessType: normalizeBusinessType(businessType) };
    case "order":
      return { routeId, href: `/order/${slug}`, businessType: normalizeBusinessType(businessType) };
    case "rent":
      return { routeId, href: `/rent/${slug}`, businessType: normalizeBusinessType(businessType) };
    case "shop":
      return { routeId, href: `/shop/${slug}`, businessType: normalizeBusinessType(businessType) };
    default:
      return { routeId: "b", href: `/b/${slug}`, businessType: normalizeBusinessType(businessType) };
  }
}

export function getPublicBusinessHrefState({
  slug,
  businessType,
}: {
  slug: string | null | undefined;
  businessType: string | null | undefined;
}): PublicBusinessHrefState {
  const safeSlug = String(slug || "").trim();
  const normalizedBusinessType = normalizeBusinessType(businessType);

  if (!safeSlug) {
    return {
      routeId: getPublicBusinessRouteId(normalizedBusinessType),
      href: "",
      businessType: normalizedBusinessType,
      isRoutable: false,
      reason: "Missing public slug",
    };
  }

  const canonicalRoute = getCanonicalPublicBusinessRoute(
    normalizedBusinessType,
    safeSlug
  );

  return {
    ...canonicalRoute,
    isRoutable: true,
    reason: null,
  };
}

export function isCanonicalPublicBusinessRoute(
  routeId: PublicBusinessRouteId,
  businessType: string | null | undefined
) {
  return getPublicBusinessRouteId(businessType) === routeId;
}

export function isOrderPublicBusinessType(
  businessType: string | null | undefined
) {
  const normalized = normalizeBusinessType(businessType);
  return normalized === "restaurant" || normalized === "food";
}

export function isBookingPublicBusinessType(
  businessType: string | null | undefined
) {
  return normalizeBusinessType(businessType) === "service";
}

export function isRentalPublicBusinessType(
  businessType: string | null | undefined
) {
  const normalized = normalizeBusinessType(businessType);
  return normalized === "rental" || normalized === "property";
}

export function isShopPublicBusinessType(
  businessType: string | null | undefined
) {
  const normalized = normalizeBusinessType(businessType);
  return (
    normalized === "store" ||
    normalized === "creator" ||
    normalized === "product"
  );
}
