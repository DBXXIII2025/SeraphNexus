import { createClient } from "@/lib/supabase/server";
import {
  PUBLIC_EXPLORE_BUSINESSES_SELECT,
  PUBLIC_EXPLORE_BUSINESSES_SELECT_LEGACY,
} from "@/lib/publicBusinessQueries";
import { getPlatformSettings } from "@/lib/platformSettings";
import ExploreClient from "./ExploreClient";
import { isMissingServiceCategoryColumnError } from "@/lib/serviceCategories";

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

  let businessQuery = await supabase
    .from("businesses")
    .select(PUBLIC_EXPLORE_BUSINESSES_SELECT)
    .eq("is_published", true)
    .order("name", { ascending: true });

  if (businessQuery.error && isMissingServiceCategoryColumnError(businessQuery.error)) {
    businessQuery = await supabase
      .from("businesses")
      .select(PUBLIC_EXPLORE_BUSINESSES_SELECT_LEGACY)
      .eq("is_published", true)
      .order("name", { ascending: true });
  }

  const { data: businesses } = businessQuery;

  return (
    <ExploreClient
      businesses={businesses || []}
      isLoggedIn={Boolean(user)}
      settings={settings}
    />
  );
}
