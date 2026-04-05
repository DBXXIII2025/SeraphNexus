import { createAdminClient } from "@/lib/supabase/server";
import {
  getAccessPlanOrder,
  normalizeAccessPlan,
  type AccessPlan,
} from "@/lib/accessPlan";

type AccessGrantRow = {
  id: string;
  user_id: string | null;
  email: string | null;
  business_id: string | null;
  plan: string | null;
  granted_by: string | null;
  granted_at: string | null;
  expires_at: string | null;
  is_active: boolean | null;
  invite_token: string | null;
  activated_at?: string | null;
  usage_limits?: Record<string, unknown> | null;
};

type AccessScopedBusiness = {
  id: string;
  owner_id?: string | null;
  plan?: unknown;
};

function normalizeEmail(value: string | null | undefined) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isGrantCurrentlyActive(grant: AccessGrantRow) {
  if (grant.is_active === false) {
    return false;
  }

  if (grant.expires_at) {
    const expiresAt = new Date(grant.expires_at).getTime();
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
      return false;
    }
  }

  return true;
}

function dedupeGrants(grants: AccessGrantRow[]) {
  const seen = new Set<string>();
  return grants.filter((grant) => {
    if (!grant.id || seen.has(grant.id)) {
      return false;
    }

    seen.add(grant.id);
    return true;
  });
}

export async function loadAccessGrants(args: {
  userId?: string | null;
  email?: string | null;
  businessIds?: string[];
}) {
  const supabaseAdmin = createAdminClient();
  const normalizedEmail = normalizeEmail(args.email);
  const businessIds = (args.businessIds || []).filter(Boolean);

  const [userGrantRows, emailGrantRows, businessGrantRows] = await Promise.all([
    args.userId
      ? supabaseAdmin
          .from("access_grants")
          .select("*")
          .eq("user_id", args.userId)
          .eq("is_active", true)
      : Promise.resolve({ data: [] as AccessGrantRow[] }),
    normalizedEmail
      ? supabaseAdmin
          .from("access_grants")
          .select("*")
          .eq("email", normalizedEmail)
          .eq("is_active", true)
      : Promise.resolve({ data: [] as AccessGrantRow[] }),
    businessIds.length > 0
      ? supabaseAdmin
          .from("access_grants")
          .select("*")
          .in("business_id", businessIds)
          .eq("is_active", true)
      : Promise.resolve({ data: [] as AccessGrantRow[] }),
  ]);

  return dedupeGrants([
    ...((userGrantRows.data || []) as AccessGrantRow[]),
    ...((emailGrantRows.data || []) as AccessGrantRow[]),
    ...((businessGrantRows.data || []) as AccessGrantRow[]),
  ]).filter(isGrantCurrentlyActive);
}

function resolveGrantPlanForBusiness(args: {
  business: AccessScopedBusiness;
  grants: AccessGrantRow[];
  userId?: string | null;
  email?: string | null;
}) {
  const normalizedEmail = normalizeEmail(args.email);
  let bestPlan: AccessPlan = "inactive";

  for (const grant of args.grants) {
    const matchesBusiness =
      !grant.business_id || grant.business_id === args.business.id;
    const matchesUser =
      (args.userId && grant.user_id === args.userId) ||
      (args.business.owner_id && grant.user_id === args.business.owner_id) ||
      (normalizedEmail && normalizeEmail(grant.email) === normalizedEmail);

    if (!matchesBusiness || !matchesUser) {
      continue;
    }

    const plan = normalizeAccessPlan(grant.plan);
    if (getAccessPlanOrder(plan) > getAccessPlanOrder(bestPlan)) {
      bestPlan = plan;
    }
  }

  return bestPlan;
}

export async function resolveAccessPlanForBusiness(args: {
  business: AccessScopedBusiness;
  userId?: string | null;
  email?: string | null;
}) {
  const storedPlan = normalizeAccessPlan(args.business.plan);

  if (storedPlan === "pro" || storedPlan === "elite") {
    return storedPlan;
  }

  const grants = await loadAccessGrants({
    userId: args.userId,
    email: args.email,
    businessIds: [args.business.id],
  });

  const grantedPlan = resolveGrantPlanForBusiness({
    business: args.business,
    grants,
    userId: args.userId,
    email: args.email,
  });

  return grantedPlan === "inactive" ? storedPlan : grantedPlan;
}

export async function resolveAccessPlansForBusinesses<T extends AccessScopedBusiness>(args: {
  businesses: T[];
  userId?: string | null;
  email?: string | null;
}) {
  const grants = await loadAccessGrants({
    userId: args.userId,
    email: args.email,
    businessIds: args.businesses.map((business) => business.id),
  });

  return args.businesses.map((business) => {
    const storedPlan = normalizeAccessPlan(business.plan);
    const effectivePlan =
      storedPlan === "pro" || storedPlan === "elite"
        ? storedPlan
        : (() => {
            const grantedPlan = resolveGrantPlanForBusiness({
              business,
              grants,
              userId: args.userId,
              email: args.email,
            });
            return grantedPlan === "inactive" ? storedPlan : grantedPlan;
          })();

    return {
      ...business,
      plan: effectivePlan,
    };
  });
}

export async function resolveAccessPlanForOwner(args: {
  ownerUserId: string;
  email?: string | null;
}) {
  const supabaseAdmin = createAdminClient();
  const [{ data: businesses }, grants] = await Promise.all([
    supabaseAdmin
      .from("businesses")
      .select("plan")
      .eq("owner_id", args.ownerUserId),
    loadAccessGrants({
      userId: args.ownerUserId,
      email: args.email,
    }),
  ]);

  let bestPlan: AccessPlan = "inactive";

  ((businesses || []) as Array<{ plan?: unknown }>).forEach((business) => {
    const plan = normalizeAccessPlan(business.plan);
    if (getAccessPlanOrder(plan) > getAccessPlanOrder(bestPlan)) {
      bestPlan = plan;
    }
  });

  grants.forEach((grant) => {
    if (grant.business_id) {
      return;
    }

    const plan = normalizeAccessPlan(grant.plan);
    if (getAccessPlanOrder(plan) > getAccessPlanOrder(bestPlan)) {
      bestPlan = plan;
    }
  });

  return bestPlan;
}
