import { createAdminClient, createClient } from "@/lib/supabase/server";
import { PUBLIC_BUSINESS_ROUTE_SELECT } from "@/lib/publicBusinessQueries";
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
    console.log("[book/page] business_type:", businessType);
  }

  if (!isBookingPublicBusinessType(businessType)) {
    redirect(getCanonicalPublicBusinessRoute(business.business_type, slug).href);
  }
  void user;

  const logoState = await loadBusinessLogoById(business.id);
  const businessPreferences = await loadBusinessPreferences(supabaseAdmin, business.id);
  const customization = await loadBusinessPageCustomization(supabaseAdmin, business.id);

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
          pageTheme: customization.theme,
          galleryImages: customization.images,
        }}
        services={serviceRows}
        isOwner={false}
      />
    </>
  );
}
