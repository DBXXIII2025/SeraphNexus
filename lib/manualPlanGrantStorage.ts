import { createAdminClient } from "@/lib/supabase/server";
import type { PlanGrantRow } from "@/lib/accessGrants";

function dedupePlanGrantRows(rows: PlanGrantRow[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (!row.id || seen.has(row.id)) {
      return false;
    }

    seen.add(row.id);
    return true;
  });
}

function getStorageErrorMessage(error: {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
} | null) {
  if (!error) {
    return "unknown";
  }

  return `${error.code || "unknown"} ${error.message || "Plan grant storage failed."}`.trim();
}

export async function loadStoredPlanGrantRows(args: {
  activeOnly?: boolean;
  userIds?: string[];
  businessIds?: string[];
}) {
  const supabaseAdmin = createAdminClient();
  const rows: PlanGrantRow[] = [];
  const userIds = Array.from(new Set((args.userIds || []).filter(Boolean)));
  const businessIds = Array.from(new Set((args.businessIds || []).filter(Boolean)));
  const queries: Promise<{ data: PlanGrantRow[] | null; error: { code?: string } | null }>[] = [];

  if (userIds.length > 0) {
    let query = supabaseAdmin.from("plan_grants").select("*").in("user_id", userIds);
    if (args.activeOnly) {
      query = query.eq("is_active", true);
    }
    queries.push(query.order("created_at", { ascending: false }) as never);
  }

  if (businessIds.length > 0) {
    let query = supabaseAdmin
      .from("plan_grants")
      .select("*")
      .in("business_id", businessIds);
    if (args.activeOnly) {
      query = query.eq("is_active", true);
    }
    queries.push(query.order("created_at", { ascending: false }) as never);
  }

  if (queries.length === 0) {
    let query = supabaseAdmin.from("plan_grants").select("*");
    if (args.activeOnly) {
      query = query.eq("is_active", true);
    }
    queries.push(query.order("created_at", { ascending: false }) as never);
  }

  const results = await Promise.all(queries);
  results.forEach((result, index) => {
    if (result.error) {
      console.error("[plan-grants] load failed", {
        queryIndex: index,
        message: result.error.message,
        details: (result.error as { details?: string }).details,
        hint: (result.error as { hint?: string }).hint,
        code: result.error.code,
      });
      throw new Error(getStorageErrorMessage(result.error));
    }

    rows.push(...((result.data || []) as PlanGrantRow[]));
  });

  return dedupePlanGrantRows(rows);
}

export async function createStoredPlanGrant(args: {
  userId: string;
  businessId: string | null;
  grantedPlan: "pro" | "elite";
  grantType: "temporary" | "permanent";
  startsAt: string;
  expiresAt: string | null;
  grantedBy: string;
  reason: string | null;
}) {
  const supabaseAdmin = createAdminClient();

  return supabaseAdmin
    .from("plan_grants")
    .insert({
      user_id: args.userId,
      business_id: args.businessId,
      granted_plan: args.grantedPlan,
      grant_type: args.grantType,
      starts_at: args.startsAt,
      expires_at: args.expiresAt,
      is_active: true,
      granted_by: args.grantedBy,
      reason: args.reason,
      updated_at: args.startsAt,
    })
    .select("*")
    .single<PlanGrantRow>();
}

export async function revokeStoredPlanGrantById(args: {
  grantId: string;
  revokedAt: string;
}) {
  const supabaseAdmin = createAdminClient();

  return supabaseAdmin
    .from("plan_grants")
    .update({
      is_active: false,
      updated_at: args.revokedAt,
    })
    .eq("id", args.grantId);
}

export async function revokeStoredPlanGrantsForScope(args: {
  userId: string;
  businessId: string | null;
  revokedAt: string;
  excludeGrantId?: string;
}) {
  const supabaseAdmin = createAdminClient();

  let query = supabaseAdmin
    .from("plan_grants")
    .update({
      is_active: false,
      updated_at: args.revokedAt,
    })
    .eq("user_id", args.userId)
    .eq("is_active", true);

  query = args.businessId
    ? query.eq("business_id", args.businessId)
    : query.is("business_id", null);

  if (args.excludeGrantId) {
    query = query.neq("id", args.excludeGrantId);
  }

  return query;
}

export async function replaceStoredPlanGrantForScope(args: {
  userId: string;
  businessId: string | null;
  grantedPlan: "pro" | "elite";
  grantType: "temporary" | "permanent";
  startsAt: string;
  expiresAt: string | null;
  grantedBy: string;
  reason: string | null;
}) {
  const createdGrantResult = await createStoredPlanGrant(args);

  if (createdGrantResult.error || !createdGrantResult.data?.id) {
    return createdGrantResult;
  }

  const revokeExistingResult = await revokeStoredPlanGrantsForScope({
    userId: args.userId,
    businessId: args.businessId,
    revokedAt: args.startsAt,
    excludeGrantId: createdGrantResult.data.id,
  });

  if (!revokeExistingResult.error) {
    return createdGrantResult;
  }

  console.error("[plan-grants] scope replace rollback", {
    createdGrantId: createdGrantResult.data.id,
    userId: args.userId,
    businessId: args.businessId,
    message: revokeExistingResult.error.message,
    details: revokeExistingResult.error.details,
    hint: revokeExistingResult.error.hint,
    code: revokeExistingResult.error.code,
  });

  const rollbackResult = await revokeStoredPlanGrantById({
    grantId: createdGrantResult.data.id,
    revokedAt: args.startsAt,
  });

  if (rollbackResult.error) {
    console.error("[plan-grants] rollback failed", {
      createdGrantId: createdGrantResult.data.id,
      userId: args.userId,
      businessId: args.businessId,
      message: rollbackResult.error.message,
      details: rollbackResult.error.details,
      hint: rollbackResult.error.hint,
      code: rollbackResult.error.code,
    });
  }

  return {
    ...createdGrantResult,
    error: revokeExistingResult.error,
  };
}
