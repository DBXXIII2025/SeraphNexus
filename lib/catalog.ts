import type { BusinessType } from "@/lib/businessModules";

type CatalogSource = "menu_items" | "products";

type CatalogRow = {
  id?: string | null;
  business_id?: string | null;
  name?: string | null;
  title?: string | null;
  description?: string | null;
  price?: number | string | null;
  unit_price?: number | string | null;
  amount?: number | string | null;
  image_url?: string | null;
  is_active?: boolean | null;
};

export type CatalogItem = {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  source: CatalogSource;
};

function normalizeCatalogName(row: CatalogRow) {
  return String(row.name ?? row.title ?? "").trim();
}

function normalizeCatalogPrice(row: CatalogRow) {
  const value = Number(row.price ?? row.unit_price ?? row.amount ?? NaN);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

function normalizeCatalogRows(
  rows: CatalogRow[] | null | undefined,
  source: CatalogSource
) {
  return (rows || [])
    .map((row): CatalogItem | null => {
      const id = String(row.id ?? "").trim();
      const businessId = String(row.business_id ?? "").trim();
      const name = normalizeCatalogName(row);
      const price = normalizeCatalogPrice(row);

      if (!id || !businessId || !name || price === null) {
        return null;
      }

      if (row.is_active === false) {
        return null;
      }

      return {
        id,
        businessId,
        name,
        description: row.description ?? null,
        price,
        imageUrl: row.image_url ?? null,
        source,
      };
    })
    .filter((item): item is CatalogItem => Boolean(item));
}

function isRestaurantType(businessType: string | null | undefined) {
  return businessType === "restaurant" || businessType === "food";
}

function isStoreType(businessType: string | null | undefined) {
  return (
    businessType === "store" ||
    businessType === "product" ||
    businessType === "creator"
  );
}

export function isCatalogBusinessType(
  businessType: string | null | undefined
): businessType is BusinessType {
  return isRestaurantType(businessType) || isStoreType(businessType);
}

export async function fetchBusinessCatalogItems({
  supabase,
  businessId,
  businessType,
}: {
  supabase: any;
  businessId: string;
  businessType: string | null | undefined;
}) {
  const [menuResult, productResult] = await Promise.all([
    supabase.from("menu_items").select("*").eq("business_id", businessId),
    supabase.from("products").select("*").eq("business_id", businessId),
  ]);

  const menuItems = normalizeCatalogRows(menuResult.data, "menu_items");
  const productItems = normalizeCatalogRows(productResult.data, "products");

  let items = productItems;
  if (isRestaurantType(businessType)) {
    items = menuItems.length > 0 ? menuItems : productItems;
  } else if (isStoreType(businessType)) {
    items = productItems.length > 0 ? productItems : menuItems;
  } else {
    items = [...menuItems, ...productItems];
  }

  return {
    items,
    menuError: menuResult.error,
    productError: productResult.error,
    counts: {
      menuItems: menuItems.length,
      products: productItems.length,
      returned: items.length,
    },
  };
}

export async function fetchCatalogItemsByIds({
  supabase,
  businessId,
  businessType,
  itemIds,
}: {
  supabase: any;
  businessId: string;
  businessType: string | null | undefined;
  itemIds: string[];
}) {
  const uniqueIds = [...new Set(itemIds.filter(Boolean))];

  if (uniqueIds.length === 0) {
    return {
      items: [],
      counts: {
        matched: 0,
      },
    };
  }

  const [menuResult, productResult] = await Promise.all([
    supabase
      .from("menu_items")
      .select("*")
      .eq("business_id", businessId)
      .in("id", uniqueIds),
    supabase
      .from("products")
      .select("*")
      .eq("business_id", businessId)
      .in("id", uniqueIds),
  ]);

  const menuItems = normalizeCatalogRows(menuResult.data, "menu_items");
  const productItems = normalizeCatalogRows(productResult.data, "products");

  const preferredSource: CatalogSource | null = isRestaurantType(businessType)
    ? "menu_items"
    : isStoreType(businessType)
      ? "products"
      : null;

  const selected = new Map<string, CatalogItem>();

  if (preferredSource === "menu_items") {
    productItems.forEach((item) => selected.set(item.id, item));
    menuItems.forEach((item) => selected.set(item.id, item));
  } else if (preferredSource === "products") {
    menuItems.forEach((item) => selected.set(item.id, item));
    productItems.forEach((item) => selected.set(item.id, item));
  } else {
    [...menuItems, ...productItems].forEach((item) => selected.set(item.id, item));
  }

  return {
    items: uniqueIds
      .map((id) => selected.get(id))
      .filter((item): item is CatalogItem => Boolean(item)),
    menuError: menuResult.error,
    productError: productResult.error,
    counts: {
      matched: selected.size,
      menuItems: menuItems.length,
      products: productItems.length,
    },
  };
}
