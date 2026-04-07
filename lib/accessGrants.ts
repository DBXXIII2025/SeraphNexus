import { createAdminClient } from "@/lib/supabase/server";
import {
  getAccessPlanOrder,
  normalizeAccessPlan,
  type AccessPlan,
} from "@/lib/accessPlan";
import { loadStoredPlanGrantRows } from "@/lib/manualPlanGrantStorage";

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

export type PlanGrantRow = {
  id: string;
  user_id: string;
  business_id: string | null;
  granted_plan: string | null;
  grant_type: string | null;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean | null;
  granted_by: string | null;
  reason: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type AccessScopedBusiness = {
  id: string;
  owner_id?: string | null;
  plan?: unknown;
};

type ResolvedPlanContext = {
  paidPlan: AccessPlan;
  trialPlan: AccessPlan;
  manualPlan: AccessPlan;
  resolvedPlan: AccessPlan;
  appliedGrantId: string | null;
  appliedGrantScope: "business" | "account" | null;
};

function normalizeEmail(value: string | null | undefined) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function dedupeStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function getTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function isWithinWindow(args: {
  startsAt?: string | null;
  expiresAt?: string | null;
  isActive?: boolean | null;
}) {
  if (args.isActive === false) {
    return false;
  }

  const now = Date.now();

  if (args.startsAt) {
    const startsAt = getTimestamp(args.startsAt);
    if (startsAt > now) {
      return false;
    }
  }

  if (args.expiresAt) {
    const expiresAt = getTimestamp(args.expiresAt);
    if (expiresAt > 0 && expiresAt <= now) {
      return false;
    }
  }

  return true;
}

function dedupeById<T extends { id: string }>(rows: T[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (!row.id || seen.has(row.id)) {
      return false;
    }

    seen.add(row.id);
    return true;
  });
}

function selectHigherPlan(current: AccessPlan, next: AccessPlan) {
  return getAccessPlanOrder(next) > getAccessPlanOrder(current) ? next : current;
}

function pickBestManualGrantForBusiness(args: {
  business: AccessScopedBusiness;
  grants: PlanGrantRow[];
  userIds: string[];
}) {
  const applicable = args.grants
    .filter((grant) => {
      const matchesBusiness =
        !grant.business_id || grant.business_id === args.business.id;
      const matchesUser = args.userIds.includes(grant.user_id);
      return matchesBusiness && matchesUser;
    })
    .sort((left, right) => {
      const leftScope = left.business_id ? 2 : 1;
      const rightScope = right.business_id ? 2 : 1;

      if (rightScope !== leftScope) {
        return rightScope - leftScope;
      }

      const planDelta =
        getAccessPlanOrder(normalizeAccessPlan(right.granted_plan)) -
        getAccessPlanOrder(normalizeAccessPlan(left.granted_plan));
      if (planDelta !== 0) {
        return planDelta;
      }

      const updatedDelta =
        getTimestamp(right.updated_at || right.created_at) -
        getTimestamp(left.updated_at || left.created_at);
      if (updatedDelta !== 0) {
        return updatedDelta;
      }

      return getTimestamp(right.starts_at) - getTimestamp(left.starts_at);
    });

  return applicable[0] || null;
}

function resolveTrialLikePlanForBusiness(args: {
  business: AccessScopedBusiness;
  grants: AccessGrantRow[];
  userIds: string[];
  email?: string | null;
}) {
  const normalizedEmail = normalizeEmail(args.email);
  let bestPlan: AccessPlan = "inactive";

  for (const grant of args.grants) {
    const matchesBusiness =
      !grant.business_id || grant.business_id === args.business.id;
    const matchesUser =
      (grant.user_id && args.userIds.includes(grant.user_id)) ||
      (normalizedEmail && normalizeEmail(grant.email) === normalizedEmail);

    if (!matchesBusiness || !matchesUser) {
      continue;
    }

    bestPlan = selectHigherPlan(bestPlan, normalizeAccessPlan(grant.plan));
  }

  return bestPlan;
}

function resolveManualOwnerPlan(args: {
  grants: PlanGrantRow[];
  ownerUserId: string;
}) {
  const applicable = args.grants
    .filter((grant) => grant.user_id === args.ownerUserId && !grant.business_id)
    .sort(
      (left, right) =>
        getAccessPlanOrder(normalizeAccessPlan(right.granted_plan)) -
          getAccessPlanOrder(normalizeAccessPlan(left.granted_plan)) ||
        getTimestamp(right.updated_at || right.created_at) -
          getTimestamp(left.updated_at || left.created_at)
    );

  return applicable.length > 0
    ? normalizeAccessPlan(applicable[0].granted_plan)
    : "inactive";
}

function resolveGlobalTrialPlan(args: {
  grants: AccessGrantRow[];
  ownerUserId: string;
  email?: string | null;
}) {
  const normalizedEmail = normalizeEmail(args.email);
  let bestPlan: AccessPlan = "inactive";

  args.grants.forEach((grant) => {
    if (grant.business_id) {
      return;
    }

    const matchesUser =
      grant.user_id === args.ownerUserId ||
      (normalizedEmail && normalizeEmail(grant.email) === normalizedEmail);

    if (!matchesUser) {
      return;
    }

    bestPlan = selectHigherPlan(bestPlan, normalizeAccessPlan(grant.plan));
  });

  return bestPlan;
}

function resolveEffectivePlan(args: {
  paidPlan: AccessPlan;
  trialPlan: AccessPlan;
  manualGrant: PlanGrantRow | null;
}): ResolvedPlanContext {
  const manualPlan = args.manualGrant
    ? normalizeAccessPlan(args.manualGrant.granted_plan)
    : "inactive";
  const resolvedPlan =
    manualPlan !== "inactive"
      ? manualPlan
      : selectHigherPlan(args.paidPlan, args.trialPlan);

  return {
    paidPlan: args.paidPlan,
    trialPlan: args.trialPlan,
    manualPlan,
    resolvedPlan,
    appliedGrantId: args.manualGrant?.id || null,
    appliedGrantScope: args.manualGrant
      ? args.manualGrant.business_id
        ? "business"
        : "account"
      : null,
  };
}

function logPlanResolution(args: {
  scope: "business" | "owner";
  targetId: string;
  userIds: string[];
  email?: string | null;
  context: ResolvedPlanContext;
}) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.info("[access-plan] resolved", {
    scope: args.scope,
    targetId: args.targetId,
    userIds: args.userIds,
    email: normalizeEmail(args.email) || null,
    paidPlan: args.context.paidPlan,
    trialPlan: args.context.trialPlan,
    manualPlan: args.context.manualPlan,
    resolvedPlan: args.context.resolvedPlan,
    appliedGrantId: args.context.appliedGrantId,
    appliedGrantScope: args.context.appliedGrantScope,
  });
}

export async function loadAccessGrants(args: {
  userIds?: string[];
  email?: string | null;
  businessIds?: string[];
}) {
  const supabaseAdmin = createAdminClient();
  const normalizedEmail = normalizeEmail(args.email);
  const userIds = dedupeStrings(args.userIds || []);
  const businessIds = dedupeStrings(args.businessIds || []);

  const [userGrantRows, emailGrantRows, businessGrantRows] = await Promise.all([
    userIds.length > 0
      ? supabaseAdmin
          .from("access_grants")
          .select("*")
          .in("user_id", userIds)
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

  return dedupeById([
    ...((userGrantRows.data || []) as AccessGrantRow[]),
    ...((emailGrantRows.data || []) as AccessGrantRow[]),
    ...((businessGrantRows.data || []) as AccessGrantRow[]),
  ]).filter((grant) =>
    isWithinWindow({
      expiresAt: grant.expires_at,
      isActive: grant.is_active,
    })
  );
}

export async function loadPlanGrants(args: {
  userIds?: string[];
  businessIds?: string[];
}) {
  const userIds = dedupeStrings(args.userIds || []);
  const businessIds = dedupeStrings(args.businessIds || []);
  return dedupeById(
    await loadStoredPlanGrantRows({
      activeOnly: true,
      userIds,
      businessIds,
    })
  ).filter((grant) =>
    isWithinWindow({
      startsAt: grant.starts_at,
      expiresAt: grant.expires_at,
      isActive: grant.is_active,
    })
  );
}

export async function resolveAccessPlanForBusiness(args: {
  business: AccessScopedBusiness;
  userId?: string | null;
  email?: string | null;
}) {
  const paidPlan = normalizeAccessPlan(args.business.plan);
  const userIds = dedupeStrings([args.userId, args.business.owner_id]);
  const [accessGrants, planGrants] = await Promise.all([
    loadAccessGrants({
      userIds,
      email: args.email,
      businessIds: [args.business.id],
    }),
    loadPlanGrants({
      userIds,
      businessIds: [args.business.id],
    }),
  ]);

  const context = resolveEffectivePlan({
    paidPlan,
    trialPlan: resolveTrialLikePlanForBusiness({
      business: args.business,
      grants: accessGrants,
      userIds,
      email: args.email,
    }),
    manualGrant: pickBestManualGrantForBusiness({
      business: args.business,
      grants: planGrants,
      userIds,
    }),
  });

  logPlanResolution({
    scope: "business",
    targetId: args.business.id,
    userIds,
    email: args.email,
    context,
  });

  return context.resolvedPlan;
}

export async function resolveAccessPlansForBusinesses<T extends AccessScopedBusiness>(args: {
  businesses: T[];
  userId?: string | null;
  email?: string | null;
}) {
  const userIds = dedupeStrings([
    args.userId,
    ...args.businesses.map((business) => business.owner_id || null),
  ]);
  const businessIds = args.businesses.map((business) => business.id);
  const [accessGrants, planGrants] = await Promise.all([
    loadAccessGrants({
      userIds,
      email: args.email,
      businessIds,
    }),
    loadPlanGrants({
      userIds,
      businessIds,
    }),
  ]);

  return args.businesses.map((business) => ({
    ...business,
    plan: resolveEffectivePlan({
      paidPlan: normalizeAccessPlan(business.plan),
      trialPlan: resolveTrialLikePlanForBusiness({
        business,
        grants: accessGrants,
        userIds: dedupeStrings([args.userId, business.owner_id]),
        email: args.email,
      }),
      manualGrant: pickBestManualGrantForBusiness({
        business,
        grants: planGrants,
        userIds: dedupeStrings([args.userId, business.owner_id]),
      }),
    }).resolvedPlan,
  }));
}

export async function resolveAccessPlanForOwner(args: {
  ownerUserId: string;
  email?: string | null;
}) {
  const supabaseAdmin = createAdminClient();
  const [{ data: businesses }, accessGrants, planGrants] = await Promise.all([
    supabaseAdmin
      .from("businesses")
      .select("plan")
      .eq("owner_id", args.ownerUserId),
    loadAccessGrants({
      userIds: [args.ownerUserId],
      email: args.email,
    }),
    loadPlanGrants({
      userIds: [args.ownerUserId],
    }),
  ]);

  let paidPlan: AccessPlan = "inactive";

  ((businesses || []) as Array<{ plan?: unknown }>).forEach((business) => {
    paidPlan = selectHigherPlan(paidPlan, normalizeAccessPlan(business.plan));
  });

  const context = resolveEffectivePlan({
    paidPlan,
    trialPlan: resolveGlobalTrialPlan({
      grants: accessGrants,
      ownerUserId: args.ownerUserId,
      email: args.email,
    }),
    manualGrant:
      resolveManualOwnerPlan({
        grants: planGrants,
        ownerUserId: args.ownerUserId,
      }) === "inactive"
        ? null
        : planGrants
            .filter((grant) => grant.user_id === args.ownerUserId && !grant.business_id)
            .sort(
              (left, right) =>
                getAccessPlanOrder(normalizeAccessPlan(right.granted_plan)) -
                  getAccessPlanOrder(normalizeAccessPlan(left.granted_plan)) ||
                getTimestamp(right.updated_at || right.created_at) -
                  getTimestamp(left.updated_at || left.created_at)
            )[0] || null,
  });

  logPlanResolution({
    scope: "owner",
    targetId: args.ownerUserId,
    userIds: [args.ownerUserId],
    email: args.email,
    context,
  });

  return context.resolvedPlan;
}
