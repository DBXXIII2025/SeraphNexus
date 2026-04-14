import { createClient } from "@/lib/supabase/server";
import { PUBLIC_BUSINESS_ROUTE_SELECT } from "@/lib/publicBusinessQueries";
import { getPublicBusinessHrefState } from "@/lib/publicBusinessRoutes";
import { loadBusinessLogoById } from "@/lib/businessLogos";
import { notFound, redirect } from "next/navigation";
import MessageBusinessButton from "@/components/MessageBusinessButton";
import LeadEventTracker from "@/components/LeadEventTracker";
import PublicBusinessPolicies from "@/components/PublicBusinessPolicies";

type Params = {
  slug: string;
};

export const dynamic = "force-dynamic";

function getInitials(name: string | null | undefined) {
  const parts = String(name || "Business")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "BN";
}

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
  const logoUrl = logoState.schemaReady ? logoState.logoUrl : null;
  const initials = getInitials(business.name);

  return (
    <div className="min-h-screen bg-[var(--bg-main)] px-4 py-10 text-[var(--text-main)]">
      <LeadEventTracker
        businessId={business.id}
        eventType="page_view"
        source={`/b/${business.slug}`}
      />
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--panel)] p-8 shadow-[0_18px_50px_rgba(60,44,8,0.12)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] shadow-inner">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={`${business.name || "Business"} logo`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-semibold tracking-[0.18em] text-[var(--text-soft)]">
                    {initials}
                  </span>
                )}
              </div>
              <div className="max-w-3xl">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-soft)]">
                  Public business page
                </p>
                <h1 className="mt-3 text-3xl font-semibold text-[var(--text-strong)]">
                  {business.name || "Business"}
                </h1>
                <p className="mt-3 text-sm text-[var(--text-soft)]">
                  This business is published, but it does not use one of the specialized public storefront routes.
                </p>
              </div>
            </div>
            <MessageBusinessButton businessId={business.id} />
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel)] p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)]">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={`${business.name || "Business"} logo mark`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xs font-semibold tracking-[0.18em] text-[var(--text-soft)]">
                  {initials}
                </span>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-strong)]">
                {business.business_type || "General"}
              </p>
              <p className="text-sm text-[var(--text-soft)]">
                Public slug: {business.slug}
              </p>
            </div>
          </div>
        </div>

        <PublicBusinessPolicies
          description={business.description || "This business has not added a public description yet."}
        />
      </div>
    </div>
  );
}
