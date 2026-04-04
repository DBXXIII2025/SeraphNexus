export type AccessPlan = "inactive" | "trial" | "pro" | "elite";

export function normalizeAccessPlan(value: unknown): AccessPlan {
  if (value === "elite") {
    return "elite";
  }

  if (value === "pro" || value === "growth") {
    return "pro";
  }

  if (value === "trial" || value === "free") {
    return "trial";
  }

  return "inactive";
}

export function hasOperationalAccess(plan: unknown) {
  return normalizeAccessPlan(plan) !== "inactive";
}

export function getAccessPlanOrder(plan: AccessPlan) {
  if (plan === "elite") return 3;
  if (plan === "pro") return 2;
  if (plan === "trial") return 1;
  return 0;
}
