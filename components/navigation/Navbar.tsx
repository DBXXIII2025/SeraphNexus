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

  return (
    <NavbarClient
      isLoggedIn={Boolean(user)}
      isPlatformAdmin={user ? await getIsPlatformAdminForUserId(user.id) : false}
      siteName={resolvePlatformName(settings)}
      logoUrl={resolvePlatformLogoUrl(settings)}
    />
  );
}
