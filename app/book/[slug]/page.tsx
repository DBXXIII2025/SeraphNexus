import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  PUBLIC_BUSINESS_ROUTE_SELECT,
  PUBLIC_BUSINESS_ROUTE_SELECT_LEGACY,
} from "@/lib/publicBusinessQueries";
import {
  getCanonicalPublicBusinessRoute,
  isBookingPublicBusinessType,
} from "@/lib/publicBusinessRoutes";
import { loadBusinessLogoById } from "@/lib/businessLogos";
import { notFound, redirect } from "next/navigation";
import LeadEventTracker from "@/components/LeadEventTracker";
import BookingClient from "./BookingClient";
import { sortServiceImages, type ServiceImageRecord } from "@/lib/serviceImages";
import { loadBusinessPreferences } from "@/lib/businessPreferences";
import { loadBusinessPageCustomization } from "@/lib/businessPageCustomization";
import { formatBusinessAddress, loadBusinessProfileFields } from "@/lib/businessProfileFields";
import { resolvePlatformLogoUrl, resolvePlatformName } from "@/lib/platformBranding";
import { getPlatformSettings } from "@/lib/platformSettings";
import {
  formatServiceCategory,
  isMissingServiceCategoryColumnError,
} from "@/lib/serviceCategories";

type Params = {
  slug: string;
};

export const dynamic = "force-dynamic";

type ServiceRow = {
  id: string;
  name: string | null;
  price: number | null;
  duration: number | null;
  business_id: string;
  description?: string | null;
  category?: string | null;
  is_active?: boolean | null;
  images: ServiceImageRecord[];
};

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;

  const supabase = await createClient();
  const { data } = await supabase
    .from("businesses")
    .select("name")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  return {
    title: data?.name || "Business",
    description: "",
  };
}

export default async function BookPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const isDev = process.env.NODE_ENV !== "production";

  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let businessQuery = await supabase
    .from("businesses")
    .select(PUBLIC_BUSINESS_ROUTE_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (businessQuery.error && isMissingServiceCategoryColumnError(businessQuery.error)) {
    businessQuery = await supabase
      .from("businesses")
      .select(PUBLIC_BUSINESS_ROUTE_SELECT_LEGACY)
      .eq("slug", slug)
      .maybeSingle();
  }

  const { data: business, error } = businessQuery;

  if (error || !business) {
    console.log("BUSINESS QUERY FAILED", error);
    notFound();
  }

  if (!business.is_published) {
    notFound();
  }

  const businessType = (business.business_type || "").toLowerCase();
  if (isDev) {
    console.log("[book/page] business_type:", businessType);
  }

  console.log("[public/book] resolved business_id", {
    slug,
    businessId: business.id,
    businessSlug: business.slug,
  });

  if (!isBookingPublicBusinessType(businessType)) {
    redirect(getCanonicalPublicBusinessRoute(business.business_type, slug).href);
  }
  void user;

  const logoState = await loadBusinessLogoById(business.id);
  const [businessPreferences, customization, profileFields, platformSettings] = await Promise.all([
    loadBusinessPreferences(supabaseAdmin, business.id),
    loadBusinessPageCustomization(supabaseAdmin, business.id),
    loadBusinessProfileFields(supabaseAdmin, business.id),
    getPlatformSettings(),
  ]);

  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("business_id", business.id)
    .order("name", { ascending: true });

  const { data: serviceImages, error: serviceImagesError } = await supabaseAdmin
    .from("service_images")
    .select(
      "id, service_id, business_id, image_url, storage_path, alt_text, sort_order, is_primary, created_at"
    )
    .eq("business_id", business.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (serviceImagesError && isDev) {
    console.log("[book/page] service image query failed:", serviceImagesError.message);
  }

  const imagesByServiceId = new Map<string, ServiceImageRecord[]>();
  ((serviceImages || []) as ServiceImageRecord[]).forEach((image) => {
    const current = imagesByServiceId.get(image.service_id) || [];
    current.push(image);
    imagesByServiceId.set(image.service_id, sortServiceImages(current));
  });

  const serviceRows = ((services || []) as Array<Omit<ServiceRow, "images">>)
    .filter((service) => service.is_active !== false)
    .map((service) => ({
      ...service,
      images: imagesByServiceId.get(service.id) || [],
    }));

  return (
    <>
      <LeadEventTracker
        businessId={business.id}
        eventType="page_view"
        source={`/book/${business.slug}`}
      />
      <BookingClient
        business={{
          ...business,
          ...businessPreferences,
          logo_url: customization.logoUrl || (logoState.schemaReady ? logoState.logoUrl : null),
          service_category:
            (business as { service_category?: string | null }).service_category || null,
          service_category_label:
            business.business_type === "service"
              ? formatServiceCategory(
                  (business as { service_category?: string | null }).service_category
                )
              : null,
          pageTheme: customization.theme,
          galleryImages: customization.images,
          platformBrand: {
            siteName: resolvePlatformName(platformSettings),
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
        services={serviceRows}
        isOwner={false}
      />
    </>
  );
}
