import { createAdminClient } from "@/lib/supabase/server";
import { fetchBusinessCatalogItems } from "@/lib/catalog";
import { PUBLIC_BUSINESS_ROUTE_SELECT } from "@/lib/publicBusinessQueries";
import {
  getCanonicalPublicBusinessRoute,
  isShopPublicBusinessType,
} from "@/lib/publicBusinessRoutes";
import { notFound, redirect } from "next/navigation";
import LeadEventTracker from "@/components/LeadEventTracker";
import ShopClient from "./ShopClient";
import { loadBusinessPreferences } from "@/lib/businessPreferences";

type Params = {
  slug: string;
};

export default async function ShopPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const supabase = createAdminClient();
  const isDev = process.env.NODE_ENV !== "production";

  const { data: business, error } = await supabase
    .from("businesses")
    .select(PUBLIC_BUSINESS_ROUTE_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (error || !business) {
    console.log("BUSINESS QUERY FAILED", error);
    notFound();
  }

  if (!business.is_published) {
    notFound();
  }

  const businessType = (business.business_type || "").toLowerCase();
  if (!isShopPublicBusinessType(businessType)) {
    redirect(getCanonicalPublicBusinessRoute(business.business_type, slug).href);
  }

  const catalog = await fetchBusinessCatalogItems({
    supabase,
    businessId: business.id,
    businessType,
  });
  const businessPreferences = await loadBusinessPreferences(supabase, business.id);

  if (isDev) {
    console.log("[shop/page] business_type:", businessType);
    console.log("[shop/page] item count:", catalog.items.length);
  }

  return (
    <>
      <LeadEventTracker
        businessId={business.id}
        eventType="page_view"
        source={`/shop/${business.slug}`}
      />
      <ShopClient
        businessId={business.id}
        businessName={business.name || "Store"}
        businessDescription={business.description || ""}
        businessType={business.business_type || "store"}
        language={businessPreferences.language}
        pickupEnabled={businessPreferences.pickup_enabled}
        deliveryEnabled={businessPreferences.delivery_enabled}
        items={catalog.items.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          image_url: item.imageUrl,
        }))}
      />
    </>
  );
}
