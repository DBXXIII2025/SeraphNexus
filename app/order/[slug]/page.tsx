import { createAdminClient } from "@/lib/supabase/server";
import { PUBLIC_BUSINESS_ROUTE_SELECT } from "@/lib/publicBusinessQueries";
import {
  getCanonicalPublicBusinessRoute,
  isOrderPublicBusinessType,
} from "@/lib/publicBusinessRoutes";
import { notFound, redirect } from "next/navigation";
import LeadEventTracker from "@/components/LeadEventTracker";
import OrderClient from "./OrderClient";
import { loadBusinessPreferences } from "@/lib/businessPreferences";
import { loadBusinessPageCustomization } from "@/lib/businessPageCustomization";

type Params = {
  slug: string;
};

export const dynamic = "force-dynamic";

export default async function OrderPage({
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

  console.log("[ORDER DEBUG]", {
    slug,
    found: !!business,
    business_type: business?.business_type,
  });

  if (error || !business) {
    console.log("BUSINESS QUERY FAILED", error);
    console.log("[order/page]", {
      slug,
      found: false,
      businessType: null,
      action: "before-notFound:missing-business",
      message: error?.message || null,
    });
    notFound();
  }

  if (!business.is_published) {
    console.log("[order/page]", {
      slug,
      found: true,
      businessType: business.business_type || null,
      action: "before-notFound:unpublished-business",
    });
    notFound();
  }

  const businessType = (business.business_type || "").toLowerCase();
  if (isDev) {
    console.log("[order/page]", {
      slug,
      found: true,
      businessType,
      businessId: business.id,
      isPublished: business.is_published,
      action: "resolved-business",
    });
  }

  if (!isOrderPublicBusinessType(businessType)) {
    redirect(getCanonicalPublicBusinessRoute(business.business_type, slug).href);
  }
  const businessPreferences = await loadBusinessPreferences(supabase, business.id);
  const customization = await loadBusinessPageCustomization(supabase, business.id);

  return (
    <>
      <LeadEventTracker
        businessId={business.id}
        eventType="page_view"
        source={`/order/${business.slug}`}
      />
      <OrderClient
        businessId={business.id}
        businessName={business.name || "Restaurant"}
        businessDescription={business.description || ""}
        businessType={business.business_type || "restaurant"}
        language={businessPreferences.language}
        pickupEnabled={businessPreferences.pickup_enabled}
        deliveryEnabled={businessPreferences.delivery_enabled}
        logoUrl={customization.logoUrl}
        pageTheme={customization.theme}
        galleryImages={customization.images}
      />
    </>
  );
}
