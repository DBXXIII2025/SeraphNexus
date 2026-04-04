import { createClient } from "@/lib/supabase/server";
import { getIsPlatformAdminForUserId } from "@/lib/platformAdmin";
import { PUBLIC_EXPLORE_BUSINESSES_SELECT } from "@/lib/publicBusinessQueries";
import { getPlatformSettings } from "@/lib/platformSettings";
import ExploreClient from "./ExploreClient";

export const metadata = {
  title: "Explore Businesses | Seraph Nexus",
  description: "Browse published services, restaurants, rentals, shops, and creators.",
};

export default async function ExplorePage() {
  const supabase = await createClient();
  const settings = await getPlatformSettings();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: businesses } = await supabase
    .from("businesses")
    .select(PUBLIC_EXPLORE_BUSINESSES_SELECT)
    .eq("is_published", true)
    .order("name", { ascending: true });

  return (
    <ExploreClient
      businesses={businesses || []}
      isLoggedIn={Boolean(user)}
      isPlatformAdmin={user ? await getIsPlatformAdminForUserId(user.id) : false}
      settings={settings}
    />
  );
}
