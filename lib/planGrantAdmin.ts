import { createAdminClient } from "@/lib/supabase/server";
import { normalizeAccessPlan, type AccessPlan } from "@/lib/accessPlan";

type LooseRow = Record<string, unknown>;
type PlanGrantStatus = "active" | "scheduled" | "expired" | "revoked";

export type PlanGrantListItem = {
  id: string;
  userId: string;
  email: string | null;
  businessId: string | null;
  businessName: string | null;
  grantedPlan: AccessPlan;
  grantType: "temporary" | "permanent";
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  grantedBy: string | null;
  reason: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  status: PlanGrantStatus;
};

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asBoolean(value: unknown) {
  return value === true;
}

function getGrantStatus(row: LooseRow): PlanGrantStatus {
  if (!asBoolean(row.is_active)) {
    return "revoked";
  }

  const now = Date.now();
  const startsAt = asString(row.starts_at);
  const expiresAt = asString(row.expires_at);

  if (startsAt) {
    const startsAtMs = new Date(startsAt).getTime();
    if (Number.isFinite(startsAtMs) && startsAtMs > now) {
      return "scheduled";
    }
  }

  if (expiresAt) {
    const expiresAtMs = new Date(expiresAt).getTime();
    if (Number.isFinite(expiresAtMs) && expiresAtMs <= now) {
      return "expired";
    }
  }

  return "active";
}

async function loadPlanGrantRows(activeOnly: boolean) {
  const supabaseAdmin = createAdminClient();
  let query = supabaseAdmin
    .from("plan_grants")
    .select("*")
    .order("created_at", { ascending: false });

  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[plan-grants] load failed", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return [] as LooseRow[];
  }

  return (data || []) as LooseRow[];
}

async function hydratePlanGrantRows(rows: LooseRow[]) {
  const supabaseAdmin = createAdminClient();
  const userIds = Array.from(
    new Set(rows.map((row) => asString(row.user_id)).filter((value): value is string => Boolean(value)))
  );
  const businessIds = Array.from(
    new Set(rows.map((row) => asString(row.business_id)).filter((value): value is string => Boolean(value)))
  );

  const [profilesResult, businessesResult] = await Promise.all([
    userIds.length > 0
      ? supabaseAdmin.from("profiles").select("id,email").in("id", userIds)
      : Promise.resolve({ data: [] as LooseRow[] }),
    businessIds.length > 0
      ? supabaseAdmin.from("businesses").select("id,name").in("id", businessIds)
      : Promise.resolve({ data: [] as LooseRow[] }),
  ]);

  const emailByUserId = new Map<string, string>();
  ((profilesResult.data || []) as LooseRow[]).forEach((profile) => {
    const id = asString(profile.id);
    const email = asString(profile.email);
    if (id && email) {
      emailByUserId.set(id, email);
    }
  });

  const businessNameById = new Map<string, string>();
  ((businessesResult.data || []) as LooseRow[]).forEach((business) => {
    const id = asString(business.id);
    if (id) {
      businessNameById.set(id, asString(business.name) || "Business");
    }
  });

  return rows.map((row) => {
    const userId = asString(row.user_id) || "";
    const businessId = asString(row.business_id);

    return {
      id: String(row.id || ""),
      userId,
      email: emailByUserId.get(userId) || null,
      businessId,
      businessName: businessId ? businessNameById.get(businessId) || null : null,
      grantedPlan: normalizeAccessPlan(row.granted_plan),
      grantType:
        asString(row.grant_type) === "temporary" ? "temporary" : "permanent",
      startsAt: asString(row.starts_at),
      expiresAt: asString(row.expires_at),
      isActive: asBoolean(row.is_active),
      grantedBy: asString(row.granted_by),
      reason: asString(row.reason),
      createdAt: asString(row.created_at),
      updatedAt: asString(row.updated_at),
      status: getGrantStatus(row),
    } satisfies PlanGrantListItem;
  });
}

export async function getActivePlanGrantList() {
  const rows = await loadPlanGrantRows(true);
  const hydrated = await hydratePlanGrantRows(rows);
  return hydrated.filter((grant) => grant.status === "active");
}

export async function getPlanGrantHistoryList() {
  const rows = await loadPlanGrantRows(false);
  return hydratePlanGrantRows(rows);
}
