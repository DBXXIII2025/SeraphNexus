import { cookies } from "next/headers";
import { BUSINESS_RUNTIME_SELECT } from "@/lib/businessFields";
import { resolveAccessPlanForBusiness } from "@/lib/accessGrants";
import { createClient } from "@/lib/supabase/server";
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
  plan: unknown;
};

export type ActiveBusiness = Omit<ActiveBusinessRow, "plan"> & {
  plan: PlanTier;
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

  async function normalizeBusiness(data: ActiveBusinessRow | null) {
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
    };
  }

  if (requestedBusinessId) {
    const { data } = await supabase
      .from("businesses")
      .select(BUSINESS_RUNTIME_SELECT)
      .eq("id", requestedBusinessId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (data) return normalizeBusiness(data as unknown as ActiveBusinessRow);
  }

  if (activeId) {
    const { data } = await supabase
      .from("businesses")
      .select(BUSINESS_RUNTIME_SELECT)
      .eq("id", activeId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (data) return normalizeBusiness(data as unknown as ActiveBusinessRow);
  }

  const { data, error } = await supabase
    .from("businesses")
    .select(BUSINESS_RUNTIME_SELECT)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[getActiveBusiness] fallback lookup failed", {
      userId: user.id,
      requestedBusinessId: requestedBusinessId || null,
      activeId: activeId || null,
      message: error.message,
    });
    return null;
  }

  return data ? normalizeBusiness(data as unknown as ActiveBusinessRow) : null;
}
