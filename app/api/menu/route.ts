import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { fetchBusinessCatalogItems } from "@/lib/catalog";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("businessId");
  const isDev = process.env.NODE_ENV !== "production";

  if (!businessId) {
    return NextResponse.json(
      { error: "Missing businessId" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, business_type")
    .eq("id", businessId)
    .maybeSingle();

  if (businessError || !business) {
    return NextResponse.json(
      { error: "Business not found" },
      { status: 404 }
    );
  }

  const [categoriesResult, itemsResult, optionGroupsResult, optionsResult, itemOptionGroupsResult] =
    await Promise.all([
      supabase
        .from("menu_categories")
        .select("*")
        .eq("business_id", businessId),
      supabase
        .from("menu_items")
        .select("*")
        .eq("business_id", businessId),
      supabase
        .from("menu_option_groups")
        .select("*")
        .eq("business_id", businessId),
      supabase
        .from("menu_options")
        .select("*")
        .eq("business_id", businessId),
      supabase
        .from("menu_item_option_groups")
        .select("*")
        .eq("business_id", businessId),
    ]);

  const catalogResult = await fetchBusinessCatalogItems({
    supabase,
    businessId,
    businessType: business.business_type,
  });

  if (
    categoriesResult.error ||
    optionGroupsResult.error ||
    optionsResult.error ||
    itemOptionGroupsResult.error
  ) {
    return NextResponse.json(
      {
        error: "Failed to load menu",
      },
      { status: 500 }
    );
  }

  const items = catalogResult.items.map((item) => ({
    id: item.id,
    business_id: item.businessId,
    name: item.name,
    description: item.description,
    price: item.price,
    image_url: item.imageUrl,
    source: item.source,
    is_active: true,
  }));

  if (isDev) {
    console.log("[api/menu] business_type:", business.business_type || null);
    console.log("[api/menu] counts:", {
      rawMenuItems: itemsResult.data?.length || 0,
      normalizedMenuItems: catalogResult.counts.menuItems,
      normalizedProducts: catalogResult.counts.products,
      returnedItems: catalogResult.counts.returned,
    });
  }

  return NextResponse.json({
    categories: categoriesResult.data || [],
    items,
    optionGroups: optionGroupsResult.data || [],
    options: optionsResult.data || [],
    itemOptionGroups: itemOptionGroupsResult.data || [],
  });
}
