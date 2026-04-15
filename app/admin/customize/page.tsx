import { redirect } from "next/navigation";
import { getBusinessProfileCompletion } from "@/lib/businessProfileCompletion";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { canAccessPlanFeature } from "@/lib/planConfig";
import { getPlatformAdminSession } from "@/lib/platformAdmin";
import { createAdminClient } from "@/lib/supabase/server";
import { loadBusinessPageCustomization } from "@/lib/businessPageCustomization";
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
  const customization = await loadBusinessPageCustomization(createAdminClient(), business.id);
  const canUseAdvancedCustomization = canAccessPlanFeature(
    business.plan,
    "advanced_customization"
  );

  return (
      <CustomizeClient
        initialBusiness={{
          id: business.id,
          name: business.name || "",
          slug: business.slug || "",
          description: business.description || "",
          business_type: business.business_type || "service",
          page_accent_color: customization.theme.accentColor,
          page_text_color: customization.theme.textColor,
          heading_font_size: customization.theme.headingFontSize,
          body_font_size: customization.theme.bodyFontSize,
        }}
        initialLogoUrl={customization.logoUrl}
        initialGalleryImages={customization.images}
        customizationSchemaReady={customization.schemaReady}
        customizationErrorMessage={customization.errorMessage}
        initialCompletion={profileCompletion}
        planNotice={
          !canUseAdvancedCustomization
            ? {
                tone: "warning",
                message:
                  "Elite adds advanced customization options, premium branding controls, and future staff workspace settings. Basic profile editing remains available below.",
              }
            : {
                tone: "success",
                message: "Elite customization is active for this workspace.",
              }
        }
      />
  );
}
