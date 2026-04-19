import { createClient } from "@/lib/supabase/server";
import { getIsPlatformAdminForUserId } from "@/lib/platformAdmin";
import { resolvePlatformLogoUrl, resolvePlatformName } from "@/lib/platformBranding";
import { getPlatformSettings } from "@/lib/platformSettings";
import NavbarClient from "./NavbarClient";

export default async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const settings = await getPlatformSettings();
  const siteName = resolvePlatformName(settings);
  const logoUrl = resolvePlatformLogoUrl(settings);

  console.info("[platform-branding] header branding payload read", {
    platformName: settings.platform_name,
    rawLogoUrl: settings.logo_url,
    resolvedLogoUrl: logoUrl,
    renderDecision: logoUrl ? "logo" : "fallback",
  });

  return (
    <NavbarClient
      isLoggedIn={Boolean(user)}
      isPlatformAdmin={user ? await getIsPlatformAdminForUserId(user.id) : false}
      siteName={siteName}
      logoUrl={logoUrl}
    />
  );
}
