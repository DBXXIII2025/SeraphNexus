import { redirect } from "next/navigation";
import { getBusinessProfileCompletion } from "@/lib/businessProfileCompletion";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { canAccessPlanFeature } from "@/lib/planConfig";
import { getPlatformAdminSession } from "@/lib/platformAdmin";
import { createAdminClient } from "@/lib/supabase/server";
import { loadBusinessPageCustomization } from "@/lib/businessPageCustomization";
import { loadBusinessProfileFieldsState } from "@/lib/businessProfileFields";
import { resolvePlatformLogoUrl, resolvePlatformName } from "@/lib/platformBranding";
import { getPlatformSettings } from "@/lib/platformSettings";
import { AdminPageContainer, DashboardPrimaryPanel } from "@/components/admin/AdminLayoutSystem";
import CustomizeClient from "./CustomizeClient";

export default async function CustomizePage() {
  const { isPlatformAdmin } = await getPlatformAdminSession();

  if (isPlatformAdmin) {
    redirect("/admin/platform");
  }

  const business = await getActiveBusiness();

  if (!business) {
    return <div className="text-[var(--text-main)]">No active business</div>;
  }

  console.log("[admin/customize] resolved active business", {
    businessId: business.id,
    slug: business.slug || null,
    name: business.name || null,
  });

  const adminClient = createAdminClient();
  const [customization, profileFieldsState, platformSettings] = await Promise.all([
    loadBusinessPageCustomization(adminClient, business.id),
    loadBusinessProfileFieldsState(adminClient, business.id),
    getPlatformSettings(),
  ]);
  const profileFields = profileFieldsState.fields;
  const profileCompletion = getBusinessProfileCompletion({
    ...business,
    ...profileFields,
  }, {
    includeOptionalProfileFields: profileFieldsState.schemaReady,
  });
  const canUseAdvancedCustomization = canAccessPlanFeature(
    business.plan,
    "advanced_customization"
  );

  return (
    <AdminPageContainer className="text-[var(--text-main)]">
      <DashboardPrimaryPanel>
        <div className="section-header-copy">
          <p className="section-kicker">Business</p>
          <h1 className="section-title">Profile and customization</h1>
          <p className="section-description">
            Update the public business profile, gallery, theme, and trust-building details without
            leaving the active workspace.
          </p>
        </div>
      </DashboardPrimaryPanel>

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
          service_category: business.service_category || "",
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
        platformBrand={{
          siteName: resolvePlatformName(platformSettings),
          logoUrl: resolvePlatformLogoUrl(platformSettings),
        }}
        customizationSchemaReady={customization.schemaReady}
        customizationErrorMessage={customization.errorMessage}
        profileFieldsSchemaReady={profileFieldsState.schemaReady}
        profileFieldsErrorMessage={profileFieldsState.errorMessage}
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
    </AdminPageContainer>
  );
}
