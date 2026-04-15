import { createClient } from "@/lib/supabase/server";
import { PUBLIC_BUSINESS_ROUTE_SELECT } from "@/lib/publicBusinessQueries";
import { getPublicBusinessHrefState } from "@/lib/publicBusinessRoutes";
import { loadBusinessLogoById } from "@/lib/businessLogos";
import { notFound, redirect } from "next/navigation";
import MessageBusinessButton from "@/components/MessageBusinessButton";
import LeadEventTracker from "@/components/LeadEventTracker";
import BusinessProfileShell from "@/components/BusinessProfileShell";
import { loadBusinessPageCustomization } from "@/lib/businessPageCustomization";

type Params = {
  slug: string;
};

export const dynamic = "force-dynamic";

export default async function PublicRouterPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
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

  if (isDev) {
    console.log("[b/page] business_type:", business.business_type || null);
  }

  const routeState = getPublicBusinessHrefState({
    slug: business.slug,
    businessType: business.business_type,
  });

  if (routeState.isRoutable && routeState.routeId !== "b") {
    redirect(routeState.href);
  }

  const logoState = await loadBusinessLogoById(business.id);
  const customization = await loadBusinessPageCustomization(supabase, business.id);
  const logoUrl = customization.logoUrl || (logoState.schemaReady ? logoState.logoUrl : null);

  return (
    <div className="min-h-screen bg-white text-[var(--business-text,#111827)]">
      <LeadEventTracker
        businessId={business.id}
        eventType="page_view"
        source={`/b/${business.slug}`}
      />
      <div className="bg-[#f5f7fb] px-3 py-4 sm:py-5">
      <BusinessProfileShell
        businessName={business.name || "Business"}
        businessDescription={business.description || ""}
        businessType={business.business_type || "General"}
        logoUrl={logoUrl}
        images={customization.images}
        theme={customization.theme}
        action={
          <MessageBusinessButton
            businessId={business.id}
            className="inline-flex items-center rounded-lg bg-[var(--business-accent)] px-4 py-2 text-sm font-medium text-[var(--business-accent-text)]"
          />
        }
      />
      </div>
    </div>
  );
}
