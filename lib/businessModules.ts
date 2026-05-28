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

export type AdminNavGroup = {
  label:
    | "Overview"
    | "Business"
    | "Commerce"
    | "Customers"
    | "Intelligence"
    | "Settings";
  items: AdminNavItem[];
};

type BusinessModule = {
  type: BusinessType;
  label: string;
  description: string;
  publicPath: (slug: string) => string;
  adminNavGroups: AdminNavGroup[];
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

function createSharedOwnerGroups(args: {
  customizeLabel?: string;
  inventoryLabel: string;
  inventoryHref: string;
  commerceLabel: string;
  commerceHref: string;
  includeAvailability?: boolean;
}): AdminNavGroup[] {
  const businessItems: AdminNavItem[] = [
    { href: "/admin/customize", label: args.customizeLabel || "Profile / Customize" },
    { href: args.inventoryHref, label: args.inventoryLabel },
  ];

  if (args.includeAvailability) {
    businessItems.push({ href: "/admin/availability", label: "Availability" });
  }

  return [
    {
      label: "Overview",
      items: [
        { href: "/admin/dashboard", label: "Dashboard" },
        { href: "/admin/analytics", label: "Analytics" },
      ],
    },
    {
      label: "Business",
      items: businessItems,
    },
    {
      label: "Commerce",
      items: [
        { href: args.commerceHref, label: args.commerceLabel },
        { href: "/admin/payments", label: "Payments" },
        { href: "/admin/promo-codes", label: "Promo Codes" },
      ],
    },
    {
      label: "Customers",
      items: [
        { href: "/admin/messages", label: "Messages" },
        { href: "/admin/leads", label: "Leads" },
        { href: "/admin/notifications", label: "Notifications" },
      ],
    },
    {
      label: "Intelligence",
      items: [{ href: "/admin/assistant", label: "Seravelle" }],
    },
    {
      label: "Settings",
      items: [
        { href: "/admin/settings", label: "Business Settings" },
        { href: "/admin/upgrade", label: "Billing / Plan" },
        { href: "/admin/stripe-payouts", label: "Stripe / Payouts" },
      ],
    },
  ];
}

export const BUSINESS_MODULES: Record<BusinessType, BusinessModule> = {
  service: {
    type: "service",
    label: "Services",
    description: "Appointments, consultations, field work",
    publicPath: (slug) => `/book/${slug}`,
    adminNavGroups: createSharedOwnerGroups({
      inventoryLabel: "Services",
      inventoryHref: "/admin/services",
      commerceLabel: "Bookings",
      commerceHref: "/admin/bookings",
      includeAvailability: true,
    }),
    primaryAdminHref: "/admin/services",
    primaryAdminLabel: "Services",
    leadsEnabled: true,
  },
  restaurant: {
    type: "restaurant",
    label: "Restaurant",
    description: "Dine-in, pickup, or delivery",
    publicPath: (slug) => `/order/${slug}`,
    adminNavGroups: createSharedOwnerGroups({
      inventoryLabel: "Products / Menu",
      inventoryHref: "/admin/products",
      commerceLabel: "Orders",
      commerceHref: "/admin/orders",
    }),
    primaryAdminHref: "/admin/products",
    primaryAdminLabel: "Menu",
    leadsEnabled: true,
  },
  food: {
    type: "food",
    label: "Food Vendor",
    description: "Food trucks, stands, or small vendors",
    publicPath: (slug) => `/order/${slug}`,
    adminNavGroups: createSharedOwnerGroups({
      inventoryLabel: "Products / Menu",
      inventoryHref: "/admin/products",
      commerceLabel: "Orders",
      commerceHref: "/admin/orders",
    }),
    primaryAdminHref: "/admin/products",
    primaryAdminLabel: "Menu",
    leadsEnabled: true,
  },
  rental: {
    type: "rental",
    label: "Rental",
    description: "Equipment or item rentals",
    publicPath: (slug) => `/rent/${slug}`,
    adminNavGroups: createSharedOwnerGroups({
      inventoryLabel: "Rentals",
      inventoryHref: "/admin/rentals",
      commerceLabel: "Bookings",
      commerceHref: "/admin/bookings",
    }),
    primaryAdminHref: "/admin/rentals",
    primaryAdminLabel: "Rentals",
    leadsEnabled: true,
  },
  property: {
    type: "property",
    label: "Property",
    description: "Vacation rentals or lodging",
    publicPath: (slug) => `/rent/${slug}`,
    adminNavGroups: createSharedOwnerGroups({
      inventoryLabel: "Rentals",
      inventoryHref: "/admin/rentals",
      commerceLabel: "Bookings",
      commerceHref: "/admin/bookings",
    }),
    primaryAdminHref: "/admin/rentals",
    primaryAdminLabel: "Rentals",
    leadsEnabled: true,
  },
  store: {
    type: "store",
    label: "Store",
    description: "Retail or online shop",
    publicPath: (slug) => `/shop/${slug}`,
    adminNavGroups: createSharedOwnerGroups({
      inventoryLabel: "Products / Menu",
      inventoryHref: "/admin/products",
      commerceLabel: "Orders",
      commerceHref: "/admin/orders",
    }),
    primaryAdminHref: "/admin/products",
    primaryAdminLabel: "Products",
    leadsEnabled: true,
  },
  creator: {
    type: "creator",
    label: "Creator",
    description: "Digital creator or influencer",
    publicPath: (slug) => `/shop/${slug}`,
    adminNavGroups: createSharedOwnerGroups({
      inventoryLabel: "Products / Menu",
      inventoryHref: "/admin/products",
      commerceLabel: "Orders",
      commerceHref: "/admin/orders",
    }),
    primaryAdminHref: "/admin/products",
    primaryAdminLabel: "Products",
    leadsEnabled: true,
  },
  product: {
    type: "product",
    label: "Product",
    description: "Sell individual products",
    publicPath: (slug) => `/shop/${slug}`,
    adminNavGroups: createSharedOwnerGroups({
      inventoryLabel: "Products / Menu",
      inventoryHref: "/admin/products",
      commerceLabel: "Orders",
      commerceHref: "/admin/orders",
    }),
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

export function getAdminNavGroups(
  businessType: string | null | undefined
): AdminNavGroup[] {
  return getBusinessModule(businessType).adminNavGroups;
}

export function getAdminNav(
  businessType: string | null | undefined
): AdminNavItem[] {
  return getAdminNavGroups(businessType).flatMap((group) => group.items);
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
