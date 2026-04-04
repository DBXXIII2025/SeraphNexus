import { BUSINESS_RUNTIME_SELECT } from "@/lib/businessFields";
import { resolveAccessPlansForBusinesses } from "@/lib/accessGrants";
import { createClient } from "@/lib/supabase/server";
import { normalizeBusinessPlanRecords } from "@/lib/businessPlan";
import type { ActiveBusiness } from "@/lib/getActiveBusiness";

export async function getUserBusinesses(): Promise<ActiveBusiness[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("businesses")
    .select(BUSINESS_RUNTIME_SELECT)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("BUSINESSES FETCH ERROR:", error);
    return [];
  }

  if (!data) {
    return [];
  }

  const normalizedBusinesses = normalizeBusinessPlanRecords(
    data as unknown as ActiveBusiness[]
  );

  return resolveAccessPlansForBusinesses({
    businesses: normalizedBusinesses,
    userId: user.id,
    email: user.email || null,
  });
}
