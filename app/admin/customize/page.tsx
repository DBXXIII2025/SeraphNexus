import { redirect } from "next/navigation";
import { getBusinessProfileCompletion } from "@/lib/businessProfileCompletion";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { canAccessPlanFeature } from "@/lib/planConfig";
import { getPlatformAdminSession } from "@/lib/platformAdmin";
import CustomizeClient from "./CustomizeClient";

export default async function CustomizePage() {
  const { isPlatformAdmin } = await getPlatformAdminSession();

  if (isPlatformAdmin) {
    redirect("/admin/platform");
  }

  const business = await getActiveBusiness();

  if (!business) {
    return <div className="text-white">No active business</div>;
  }

  const profileCompletion = getBusinessProfileCompletion(business);
  const canUseAdvancedCustomization = canAccessPlanFeature(
    business.plan,
    "advanced_customization"
  );

  return (
    <div className="space-y-6">
      {!canUseAdvancedCustomization ? (
        <div className="rounded-xl border border-[rgba(212,175,55,0.18)] bg-[rgba(212,175,55,0.08)] px-4 py-3 text-sm text-[var(--accent-gold-soft)]">
          Elite adds advanced customization options, premium branding controls, and future staff
          workspace settings. Basic profile editing remains available below.
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          Elite customization is active for this workspace.
        </div>
      )}

      <CustomizeClient
        initialBusiness={{
          id: business.id,
          name: business.name || "",
          slug: business.slug || "",
          description: business.description || "",
          business_type: business.business_type || "service",
        }}
        initialCompletion={profileCompletion}
      />
    </div>
  );
}
