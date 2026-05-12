export type AccessPlan = "inactive" | "starter" | "pro" | "elite";

export function normalizeAccessPlan(value: unknown): AccessPlan {
  if (value === "elite") {
    return "elite";
  }

  if (value === "pro" || value === "growth") {
    return "pro";
  }

  if (value === "starter" || value === "trial" || value === "free") {
    return "starter";
  }

  return "inactive";
}

export function hasOperationalAccess(plan: unknown) {
  return normalizeAccessPlan(plan) !== "inactive";
}

export function getAccessPlanOrder(plan: AccessPlan) {
  if (plan === "elite") return 3;
  if (plan === "pro") return 2;
  if (plan === "starter") return 1;
  return 0;
}
