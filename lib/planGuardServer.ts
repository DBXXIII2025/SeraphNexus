import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import {
  comparePlans,
  normalizeBusinessPlan,
  type PlanTier,
} from "@/lib/planConfig";

export async function requirePlan(feature: "leads") {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const business = await getActiveBusiness();

  if (!business) {
    return { ok: false, status: 404, error: "Business not found" };
  }

  const plan = normalizeBusinessPlan(business.plan);
  const requiredPlans: Record<typeof feature, PlanTier> = {
    leads: "pro",
  };

  if (!comparePlans(plan, requiredPlans[feature])) {
    return {
      ok: false,
      status: 403,
      error: `Upgrade required for ${feature}`,
    };
  }

  return {
    ok: true,
    business: {
      ...business,
      plan,
    },
  };
}
