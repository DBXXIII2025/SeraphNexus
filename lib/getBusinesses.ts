import { BUSINESS_RUNTIME_SELECT } from "@/lib/businessFields";
import { resolveAccessPlansForBusinesses } from "@/lib/accessGrants";
import { getBusinessStaffRole, getStaffBusinessIdsForUser } from "@/lib/businessStaff";
import { createAdminClient, createClient } from "@/lib/supabase/server";
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

  const ownedBusinesses = (data || []) as unknown as ActiveBusiness[];
  const staffBusinessIds = await getStaffBusinessIdsForUser(user.id);
  let staffBusinesses: ActiveBusiness[] = [];

  if (staffBusinessIds.length > 0) {
    const { data: staffData, error: staffError } = await createAdminClient()
      .from("businesses")
      .select(BUSINESS_RUNTIME_SELECT)
      .in("id", staffBusinessIds)
      .order("created_at", { ascending: false });

    if (staffError) {
      console.error("STAFF BUSINESSES FETCH ERROR:", staffError);
    } else {
      staffBusinesses = await Promise.all(
        ((staffData || []) as unknown as ActiveBusiness[]).map(async (business) => ({
          ...business,
          access_role:
            (await getBusinessStaffRole({ businessId: business.id, userId: user.id })) ||
            "staff",
        }))
      );
    }
  }

  const mergedBusinesses = new Map<string, ActiveBusiness>();
  for (const business of ownedBusinesses) {
    mergedBusinesses.set(business.id, { ...business, access_role: "owner" });
  }
  for (const business of staffBusinesses) {
    if (!mergedBusinesses.has(business.id)) {
      mergedBusinesses.set(business.id, business);
    }
  }

  const normalizedBusinesses = normalizeBusinessPlanRecords(
    Array.from(mergedBusinesses.values())
  );

  return resolveAccessPlansForBusinesses({
    businesses: normalizedBusinesses,
    userId: user.id,
    email: user.email || null,
  });
}
