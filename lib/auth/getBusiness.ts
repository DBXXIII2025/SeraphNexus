import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/getActiveBusiness";

export async function getBusiness() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Unauthorized");
  }

  const business = await getActiveBusiness();

  if (!business) {
    throw new Error("Business not found");
  }

  return {
    supabase,
    user,
    business,
    businessId: business.id,
  };
}
