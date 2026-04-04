import { createClient } from "@/lib/supabase/server";
import { getIsPlatformAdminForUserId } from "@/lib/platformAdmin";
import NavbarClient from "./NavbarClient";

export default async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <NavbarClient
      isLoggedIn={Boolean(user)}
      isPlatformAdmin={user ? await getIsPlatformAdminForUserId(user.id) : false}
    />
  );
}
