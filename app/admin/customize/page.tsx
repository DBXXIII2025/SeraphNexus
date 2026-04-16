import { redirect } from "next/navigation";
import { getBusinessProfileCompletion } from "@/lib/businessProfileCompletion";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { canAccessPlanFeature } from "@/lib/planConfig";
import { getPlatformAdminSession } from "@/lib/platformAdmin";
import { createAdminClient } from "@/lib/supabase/server";
import { loadBusinessPageCustomization } from "@/lib/businessPageCustomization";
import { loadBusinessProfileFields } from "@/lib/businessProfileFields";
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

  const adminClient = createAdminClient();
  const [customization, profileFields] = await Promise.all([
    loadBusinessPageCustomization(adminClient, business.id),
    loadBusinessProfileFields(adminClient, business.id),
  ]);
  const profileCompletion = getBusinessProfileCompletion({
    ...business,
    ...profileFields,
  });
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
          phone: profileFields.phone || "",
          email: profileFields.email || "",
          website: profileFields.website || "",
          address: profileFields.address || "",
          city: profileFields.city || "",
          state: profileFields.state || "",
          zip: profileFields.zip || "",
          country: profileFields.country || "",
          social_facebook: profileFields.social_facebook || "",
          social_instagram: profileFields.social_instagram || "",
          social_twitter: profileFields.social_twitter || "",
          service_area: profileFields.service_area || "",
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
