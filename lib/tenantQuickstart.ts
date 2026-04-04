import { isOrderBusinessType, isRentalBusinessType } from "@/lib/businessModules";

export type TenantQuickstart = {
  title: string;
  description: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
};

export function getTenantQuickstart(
  businessType: string | null | undefined
): TenantQuickstart {
  if (isRentalBusinessType(businessType)) {
    return {
      title: businessType === "property" ? "Create your first listing" : "Create your first rental item",
      description:
        businessType === "property"
          ? "Add one real property listing with pricing so guests can browse availability and move toward reservation-ready setup."
          : "Add one real rental item with pricing so customers can browse inventory and move toward reservation-ready setup.",
      primaryLabel: businessType === "property" ? "Add first listing" : "Add rental inventory",
      primaryHref: "/admin/rentals",
      secondaryLabel: "Review reservations",
      secondaryHref: "/admin/bookings",
    };
  }

  if (isOrderBusinessType(businessType)) {
    const isMenu = businessType === "restaurant" || businessType === "food";
    return {
      title: isMenu ? "Create your first menu item" : "Create your first product",
      description: isMenu
        ? "Add a real menu item so customers can start placing orders and your ordering workflow becomes usable."
        : "Add a real product so customers can browse and buy, then continue into orders and fulfillment.",
      primaryLabel: isMenu ? "Add menu item" : "Add product",
      primaryHref: "/admin/products",
      secondaryLabel: "Review orders",
      secondaryHref: "/admin/orders",
    };
  }

  return {
    title: "Create your first service",
    description:
      "Add one real service with pricing so customers can start booking and your business can move toward launch readiness.",
    primaryLabel: "Add service",
    primaryHref: "/admin/services",
    secondaryLabel: "Review bookings",
    secondaryHref: "/admin/bookings",
  };
}
