import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import {
  comparePlans,
  normalizeBusinessPlan,
  type PlanTier,
} from "@/lib/planConfig";

type Feature = "leads" | "ai";

const REQUIRED_PLAN_BY_FEATURE: Record<Feature, PlanTier> = {
  leads: "pro",
  ai: "pro",
};

export async function requirePlan(feature: Feature) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized",
    };
  }

  const business = await getActiveBusiness();

  if (!business) {
    return {
      ok: false,
      status: 404,
      error: "Business not found",
    };
  }

  const plan = normalizeBusinessPlan(business.plan);
  const requiredPlan = REQUIRED_PLAN_BY_FEATURE[feature];

  if (!comparePlans(plan, requiredPlan)) {
    return {
      ok: false,
      status: 403,
      error: "Upgrade required",
      upgrade: true,
      current_plan: plan,
      required_plan: requiredPlan,
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
