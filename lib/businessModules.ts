import { getCanonicalPublicBusinessRoute } from "@/lib/publicBusinessRoutes";

export type BusinessType =
  | "service"
  | "restaurant"
  | "food"
  | "rental"
  | "property"
  | "store"
  | "creator"
  | "product";

export type AdminNavItem = {
  href: string;
  label: string;
};

type BusinessModule = {
  type: BusinessType;
  label: string;
  description: string;
  publicPath: (slug: string) => string;
  adminNav: AdminNavItem[];
  primaryAdminHref: string;
  primaryAdminLabel: string;
  leadsEnabled: boolean;
};

export const BUSINESS_TYPE_VALUES = [
  "service",
  "restaurant",
  "food",
  "rental",
  "property",
  "store",
  "creator",
  "product",
] as const satisfies readonly BusinessType[];

export const CREATE_BUSINESS_TYPE_OPTIONS = [
  {
    value: "service" as const,
    label: "Services",
    description: "Appointments, consultations, field work",
  },
  {
    value: "restaurant" as const,
    label: "Restaurant",
    description: "Dine-in, pickup, or delivery",
  },
  {
    value: "food" as const,
    label: "Food Vendor",
    description: "Food trucks, stands, or small vendors",
  },
  {
    value: "rental" as const,
    label: "Rental",
    description: "Equipment or item rentals",
  },
  {
    value: "property" as const,
    label: "Property",
    description: "Vacation rentals or lodging",
  },
  {
    value: "store" as const,
    label: "Store",
    description: "Retail or online shop",
  },
  {
    value: "creator" as const,
    label: "Creator",
    description: "Digital creator or influencer",
  },
  {
    value: "product" as const,
    label: "Product",
    description: "Sell individual products",
  },
] satisfies ReadonlyArray<{
  value: BusinessType;
  label: string;
  description: string;
}>;

export const BUSINESS_MODULES: Record<BusinessType, BusinessModule> = {
  service: {
    type: "service",
    label: "Services",
    description: "Appointments, consultations, field work",
    publicPath: (slug) => `/book/${slug}`,
    adminNav: [
      { href: "/admin/dashboard", label: "Overview" },
      { href: "/admin/services", label: "Services" },
      { href: "/admin/bookings", label: "Bookings" },
      { href: "/admin/messages", label: "Messages" },
      { href: "/admin/payments", label: "Payments" },
      { href: "/admin/analytics", label: "Analytics" },
      { href: "/admin/settings", label: "Settings" },
      { href: "/admin/leads", label: "Leads" },
    ],
    primaryAdminHref: "/admin/services",
    primaryAdminLabel: "Services",
    leadsEnabled: true,
  },
  restaurant: {
    type: "restaurant",
    label: "Restaurant",
    description: "Dine-in, pickup, or delivery",
    publicPath: (slug) => `/order/${slug}`,
    adminNav: [
      { href: "/admin/dashboard", label: "Overview" },
      { href: "/admin/products", label: "Menu" },
      { href: "/admin/orders", label: "Orders" },
      { href: "/admin/messages", label: "Messages" },
      { href: "/admin/payments", label: "Payments" },
      { href: "/admin/analytics", label: "Analytics" },
      { href: "/admin/settings", label: "Settings" },
      { href: "/admin/leads", label: "Leads" },
    ],
    primaryAdminHref: "/admin/products",
    primaryAdminLabel: "Menu",
    leadsEnabled: true,
  },
  food: {
    type: "food",
    label: "Food Vendor",
    description: "Food trucks, stands, or small vendors",
    publicPath: (slug) => `/order/${slug}`,
    adminNav: [
      { href: "/admin/dashboard", label: "Overview" },
      { href: "/admin/products", label: "Menu" },
      { href: "/admin/orders", label: "Orders" },
      { href: "/admin/messages", label: "Messages" },
      { href: "/admin/payments", label: "Payments" },
      { href: "/admin/analytics", label: "Analytics" },
      { href: "/admin/settings", label: "Settings" },
      { href: "/admin/leads", label: "Leads" },
    ],
    primaryAdminHref: "/admin/products",
    primaryAdminLabel: "Menu",
    leadsEnabled: true,
  },
  rental: {
    type: "rental",
    label: "Rental",
    description: "Equipment or item rentals",
    publicPath: (slug) => `/rent/${slug}`,
    adminNav: [
      { href: "/admin/dashboard", label: "Overview" },
      { href: "/admin/rentals", label: "Inventory & Calendar" },
      { href: "/admin/bookings", label: "Reservations" },
      { href: "/admin/messages", label: "Messages" },
      { href: "/admin/payments", label: "Payments" },
      { href: "/admin/analytics", label: "Analytics" },
      { href: "/admin/settings", label: "Settings" },
      { href: "/admin/leads", label: "Leads" },
    ],
    primaryAdminHref: "/admin/rentals",
    primaryAdminLabel: "Inventory",
    leadsEnabled: true,
  },
  property: {
    type: "property",
    label: "Property",
    description: "Vacation rentals or lodging",
    publicPath: (slug) => `/rent/${slug}`,
    adminNav: [
      { href: "/admin/dashboard", label: "Overview" },
      { href: "/admin/rentals", label: "Listings & Calendar" },
      { href: "/admin/bookings", label: "Reservations" },
      { href: "/admin/messages", label: "Messages" },
      { href: "/admin/payments", label: "Payments" },
      { href: "/admin/analytics", label: "Analytics" },
      { href: "/admin/settings", label: "Settings" },
      { href: "/admin/leads", label: "Leads" },
    ],
    primaryAdminHref: "/admin/rentals",
    primaryAdminLabel: "Listings",
    leadsEnabled: true,
  },
  store: {
    type: "store",
    label: "Store",
    description: "Retail or online shop",
    publicPath: (slug) => `/shop/${slug}`,
    adminNav: [
      { href: "/admin/dashboard", label: "Overview" },
      { href: "/admin/products", label: "Products" },
      { href: "/admin/orders", label: "Orders" },
      { href: "/admin/messages", label: "Messages" },
      { href: "/admin/payments", label: "Payments" },
      { href: "/admin/analytics", label: "Analytics" },
      { href: "/admin/settings", label: "Settings" },
      { href: "/admin/leads", label: "Leads" },
    ],
    primaryAdminHref: "/admin/products",
    primaryAdminLabel: "Products",
    leadsEnabled: true,
  },
  creator: {
    type: "creator",
    label: "Creator",
    description: "Digital creator or influencer",
    publicPath: (slug) => `/shop/${slug}`,
    adminNav: [
      { href: "/admin/dashboard", label: "Overview" },
      { href: "/admin/products", label: "Products" },
      { href: "/admin/orders", label: "Orders" },
      { href: "/admin/messages", label: "Messages" },
      { href: "/admin/payments", label: "Payments" },
      { href: "/admin/analytics", label: "Analytics" },
      { href: "/admin/settings", label: "Settings" },
      { href: "/admin/leads", label: "Leads" },
    ],
    primaryAdminHref: "/admin/products",
    primaryAdminLabel: "Products",
    leadsEnabled: true,
  },
  product: {
    type: "product",
    label: "Product",
    description: "Sell individual products",
    publicPath: (slug) => `/shop/${slug}`,
    adminNav: [
      { href: "/admin/dashboard", label: "Overview" },
      { href: "/admin/products", label: "Products" },
      { href: "/admin/orders", label: "Orders" },
      { href: "/admin/messages", label: "Messages" },
      { href: "/admin/payments", label: "Payments" },
      { href: "/admin/analytics", label: "Analytics" },
      { href: "/admin/settings", label: "Settings" },
      { href: "/admin/leads", label: "Leads" },
    ],
    primaryAdminHref: "/admin/products",
    primaryAdminLabel: "Products",
    leadsEnabled: true,
  },
};

export function isBusinessType(value: unknown): value is BusinessType {
  return (
    typeof value === "string" &&
    BUSINESS_TYPE_VALUES.includes(value as BusinessType)
  );
}

export function getBusinessModule(
  businessType: string | null | undefined
): BusinessModule {
  const normalized = (businessType || "service").toLowerCase();
  return BUSINESS_MODULES[normalized as BusinessType] || BUSINESS_MODULES.service;
}

export function getPublicPath(
  businessType: string | null | undefined,
  slug: string
) {
  return getCanonicalPublicBusinessRoute(businessType, slug).href;
}

export function getAdminNav(
  businessType: string | null | undefined
): AdminNavItem[] {
  const nav = [...getBusinessModule(businessType).adminNav];

  return [
    ...nav,
    { href: "/admin/support", label: "Support" },
    { href: "/admin/upgrade", label: "Upgrade" },
    { href: "/admin/platform", label: "Platform" },
  ];
}

export function isOrderBusinessType(
  businessType: string | null | undefined
) {
  return (
    businessType === "restaurant" ||
    businessType === "food" ||
    businessType === "store" ||
    businessType === "creator" ||
    businessType === "product"
  );
}

export function isBookingBusinessType(
  businessType: string | null | undefined
) {
  return (
    businessType === "service" ||
    businessType === "rental" ||
    businessType === "property"
  );
}

export function isRentalBusinessType(
  businessType: string | null | undefined
) {
  return businessType === "rental" || businessType === "property";
}
