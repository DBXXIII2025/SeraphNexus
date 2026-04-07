import { createAdminClient } from "@/lib/supabase/server";
import type { PlanGrantRow } from "@/lib/accessGrants";

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
  results.forEach((result) => {
    if (!result.error) {
      rows.push(...((result.data || []) as PlanGrantRow[]));
    }
  });

  return rows;
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

  return supabaseAdmin.from("plan_grants").insert({
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
  });
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

  return query;
}
