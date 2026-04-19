import { createAdminClient, createClient } from "@/lib/supabase/server";
import { PUBLIC_BUSINESS_ROUTE_SELECT } from "@/lib/publicBusinessQueries";
import {
  getCanonicalPublicBusinessRoute,
  isRentalPublicBusinessType,
} from "@/lib/publicBusinessRoutes";
import { notFound, redirect } from "next/navigation";
import LeadEventTracker from "@/components/LeadEventTracker";
import RentalCatalogClient from "./RentalCatalogClient";
import type { Database } from "@/types/database";
import { loadBusinessPreferences } from "@/lib/businessPreferences";
import { loadBusinessPageCustomization } from "@/lib/businessPageCustomization";
import { formatBusinessAddress, loadBusinessProfileFields } from "@/lib/businessProfileFields";
import { resolvePlatformLogoUrl, resolvePlatformSiteName } from "@/lib/platformBranding";
import { getPlatformSettings } from "@/lib/platformSettings";

type PropertyRow = Database["public"]["Tables"]["property"]["Row"];
type PropertyContentRow = Pick<
  Database["public"]["Tables"]["property_content"]["Row"],
  "property_id" | "title" | "description"
>;
type RentalPropertyView = PropertyRow & {
  description?: string | null;
};

type Params = {
  slug: string;
};

export const dynamic = "force-dynamic";

export default async function RentPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const supabase = createAdminClient();
  const sessionClient = await createClient();
  const isDev = process.env.NODE_ENV !== "production";

  const {
    data: { user },
  } = await sessionClient.auth.getUser();

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
  if (isDev) {
    console.log("[rent/page] business_type:", businessType);
  }

  console.log("[public/rent] resolved business_id", {
    slug,
    businessId: business.id,
    businessSlug: business.slug,
  });

  if (!isRentalPublicBusinessType(businessType)) {
    redirect(getCanonicalPublicBusinessRoute(business.business_type, slug).href);
  }
  void user;

  const [{ data: properties }, { data: propertyContent }] = await Promise.all([
    supabase.from("property").select("*").eq("business_id", business.id),
    supabase
      .from("property_content")
      .select("property_id, title, description")
      .eq("business_id", business.id),
  ]);

  const propertyRows: PropertyRow[] = properties || [];
  const propertyContentRows: PropertyContentRow[] = (propertyContent || []).map((content) => ({
    property_id: content.property_id,
    title: content.title,
    description: content.description,
  }));

  const propertyContentById = new Map(
    propertyContentRows.map((content) => [
      String(content.property_id),
      {
        title: content.title || null,
        description: content.description || null,
      },
    ])
  );
  const mergedProperties: RentalPropertyView[] = propertyRows.map((property) => {
    const content = propertyContentById.get(String(property.id));

    return {
      ...property,
      name: property.name || content?.title || "Listing",
      description: property.description || content?.description || null,
    };
  });

  if (isDev) {
    console.log("[rent/page] item count:", mergedProperties.length);
  }
  const [businessPreferences, customization, profileFields, platformSettings] = await Promise.all([
    loadBusinessPreferences(supabase, business.id),
    loadBusinessPageCustomization(supabase, business.id),
    loadBusinessProfileFields(supabase, business.id),
    getPlatformSettings(),
  ]);

  return (
    <>
      <LeadEventTracker
        businessId={business.id}
        eventType="page_view"
        source={`/rent/${business.slug}`}
      />
      <RentalCatalogClient
        business={{
          id: business.id,
          name: business.name || "Rental business",
          description: business.description || "",
          business_type: business.business_type || "rental",
          language: businessPreferences.language,
          logo_url: customization.logoUrl,
          pageTheme: customization.theme,
          galleryImages: customization.images,
          platformBrand: {
            siteName: resolvePlatformSiteName(platformSettings),
            logoUrl: resolvePlatformLogoUrl(platformSettings),
          },
          profileContact: {
            phone: profileFields.phone,
            email: profileFields.email,
            website: profileFields.website,
            address: formatBusinessAddress(profileFields),
            serviceArea: profileFields.service_area,
            facebook: profileFields.social_facebook,
            instagram: profileFields.social_instagram,
            twitter: profileFields.social_twitter,
          },
        }}
        isOwner={false}
        properties={mergedProperties}
      />
    </>
  );
}

