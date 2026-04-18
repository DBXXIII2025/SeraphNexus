import { cookies } from "next/headers";
import { BUSINESS_RUNTIME_SELECT } from "@/lib/businessFields";
import { resolveAccessPlanForBusiness } from "@/lib/accessGrants";
import {
  getBusinessStaffRole,
  getStaffBusinessIdsForUser,
  type BusinessStaffRole,
} from "@/lib/businessStaff";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { normalizeBusinessPlanRecord } from "@/lib/businessPlan";
import type { PlanTier } from "@/lib/planConfig";

type ActiveBusinessRow = {
  id: string;
  created_at: string | null;
  owner_id: string | null;
  name: string | null;
  description: string | null;
  is_published: boolean | null;
  slug: string | null;
  business_type: string | null;
  stripe_account_id: string | null;
  stripe_customer_id: string | null;
  stripe_onboarding_complete: boolean | null;
  stripe_charges_enabled: boolean | null;
  stripe_payouts_enabled: boolean | null;
  language?: "en" | "es" | null;
  pickup_enabled?: boolean | null;
  delivery_enabled?: boolean | null;
  onsite_enabled?: boolean | null;
  remote_enabled?: boolean | null;
  plan: unknown;
};

export type ActiveBusiness = Omit<ActiveBusinessRow, "plan"> & {
  plan: PlanTier;
  access_role: "owner" | BusinessStaffRole;
};

export async function getActiveBusiness(
  requestedBusinessId?: string | null
): Promise<ActiveBusiness | null> {
  const supabase = await createClient();
  const cookieStore = await cookies();

  const activeId = cookieStore.get("active_business_id")?.value;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  async function normalizeBusiness(
    data: ActiveBusinessRow | null,
    accessRole: "owner" | BusinessStaffRole
  ) {
    if (!data) {
      return null;
    }

    const normalized = normalizeBusinessPlanRecord(data);
    const plan = await resolveAccessPlanForBusiness({
      business: {
        id: normalized.id,
        owner_id: normalized.owner_id,
        plan: normalized.plan,
      },
      userId: user.id,
      email: user.email || null,
    });

    return {
      ...normalized,
      plan,
      access_role: accessRole,
    };
  }

  if (requestedBusinessId) {
    const { data } = await supabase
      .from("businesses")
      .select(BUSINESS_RUNTIME_SELECT)
      .eq("id", requestedBusinessId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (data) return normalizeBusiness(data as unknown as ActiveBusinessRow, "owner");

    const staffRole = await getBusinessStaffRole({
      businessId: requestedBusinessId,
      userId: user.id,
    });

    if (staffRole) {
      const { data: staffBusiness } = await createAdminClient()
        .from("businesses")
        .select(BUSINESS_RUNTIME_SELECT)
        .eq("id", requestedBusinessId)
        .maybeSingle();

      if (staffBusiness) {
        return normalizeBusiness(staffBusiness as unknown as ActiveBusinessRow, staffRole);
      }
    }
  }

  if (activeId) {
    const { data } = await supabase
      .from("businesses")
      .select(BUSINESS_RUNTIME_SELECT)
      .eq("id", activeId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (data) return normalizeBusiness(data as unknown as ActiveBusinessRow, "owner");

    const staffRole = await getBusinessStaffRole({
      businessId: activeId,
      userId: user.id,
    });

    if (staffRole) {
      const { data: staffBusiness } = await createAdminClient()
        .from("businesses")
        .select(BUSINESS_RUNTIME_SELECT)
        .eq("id", activeId)
        .maybeSingle();

      if (staffBusiness) {
        return normalizeBusiness(staffBusiness as unknown as ActiveBusinessRow, staffRole);
      }
    }
  }

  const { data: ownedBusinesses, error } = await supabase
    .from("businesses")
    .select(BUSINESS_RUNTIME_SELECT)
    .eq("owner_id", user.id)
    .limit(2);

  if (error) {
    console.error("[getActiveBusiness] owner lookup failed", {
      userId: user.id,
      requestedBusinessId: requestedBusinessId || null,
      activeId: activeId || null,
      message: error.message,
    });
    return null;
  }

  if (ownedBusinesses?.length === 1) {
    console.log("[getActiveBusiness] resolved sole owner business", {
      userId: user.id,
      requestedBusinessId: requestedBusinessId || null,
      activeId: activeId || null,
      businessId: ownedBusinesses[0].id,
    });
    return normalizeBusiness(ownedBusinesses[0] as unknown as ActiveBusinessRow, "owner");
  }

  if ((ownedBusinesses?.length || 0) > 1) {
    console.warn("[getActiveBusiness] no selected business and multiple owner businesses exist", {
      userId: user.id,
      requestedBusinessId: requestedBusinessId || null,
      activeId: activeId || null,
      businessIds: ownedBusinesses?.map((business) => business.id) || [],
    });
    return null;
  }

  const staffBusinessIds = await getStaffBusinessIdsForUser(user.id);

  if (staffBusinessIds.length === 1) {
    const firstStaffBusinessId = staffBusinessIds[0];
    const staffRole = await getBusinessStaffRole({
      businessId: firstStaffBusinessId,
      userId: user.id,
    });
    if (staffRole) {
      const { data: staffBusiness } = await createAdminClient()
        .from("businesses")
        .select(BUSINESS_RUNTIME_SELECT)
        .eq("id", firstStaffBusinessId)
        .maybeSingle();

      if (staffBusiness) {
        return normalizeBusiness(staffBusiness as unknown as ActiveBusinessRow, staffRole);
      }
    }
  }

  if (staffBusinessIds.length > 1) {
    console.warn("[getActiveBusiness] no selected business and multiple staff businesses exist", {
      userId: user.id,
      requestedBusinessId: requestedBusinessId || null,
      activeId: activeId || null,
      businessIds: staffBusinessIds,
    });
  }

  return null;
}
