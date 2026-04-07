import { getAuthUserEmailsByIds } from "@/lib/adminAuthUsers";
import { normalizeAccessPlan, type AccessPlan } from "@/lib/accessPlan";
import {
  resolveAccessPlanForBusiness,
  resolveAccessPlanForOwner,
} from "@/lib/accessGrants";
import { loadStoredPlanGrantRows } from "@/lib/manualPlanGrantStorage";
import { createAdminClient } from "@/lib/supabase/server";

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
  grantedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  grantedBy: string | null;
  reason: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  status: PlanGrantStatus;
  effectivePlan: AccessPlan;
  appliesNow: boolean;
  storedPlan: AccessPlan;
  scopeLabel: string;
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
  const rows = await loadStoredPlanGrantRows({
    activeOnly,
  });

  return rows as unknown as LooseRow[];
}

export async function getPlanGrantHistoryList() {
  const rows = await loadPlanGrantRows(false);
  const supabaseAdmin = createAdminClient();
  const userIds = Array.from(
    new Set(
      rows
        .map((row) => asString(row.user_id))
        .filter((value): value is string => Boolean(value))
    )
  );
  const businessIds = Array.from(
    new Set(
      rows
        .map((row) => asString(row.business_id))
        .filter((value): value is string => Boolean(value))
    )
  );

  const [emailByUserId, businessesResult] = await Promise.all([
    getAuthUserEmailsByIds(userIds),
    businessIds.length > 0
      ? supabaseAdmin
          .from("businesses")
          .select("id,name,owner_id,plan")
          .in("id", businessIds)
      : Promise.resolve({ data: [] as LooseRow[] }),
  ]);

  const businessById = new Map<
    string,
    { name: string | null; ownerId: string | null; plan: AccessPlan }
  >();
  ((businessesResult.data || []) as LooseRow[]).forEach((business) => {
    const id = asString(business.id);
    if (id) {
      businessById.set(id, {
        name: asString(business.name),
        ownerId: asString(business.owner_id),
        plan: normalizeAccessPlan(business.plan),
      });
    }
  });

  const hydrated = await Promise.all(
    rows.map(async (row) => {
      const userId = asString(row.user_id) || "";
      const email = emailByUserId.get(userId) || null;
      const businessId = asString(row.business_id);
      const business = businessId ? businessById.get(businessId) || null : null;
      const status = getGrantStatus(row);
      const grantedPlan = normalizeAccessPlan(row.granted_plan);
      const storedPlan = business ? business.plan : "inactive";
      const effectivePlan = business
        ? await resolveAccessPlanForBusiness({
            business: {
              id: businessId!,
              owner_id: business.ownerId,
              plan: business.plan,
            },
            userId,
            email,
          })
        : await resolveAccessPlanForOwner({
            ownerUserId: userId,
            email,
          });

      return {
        id: String(row.id || ""),
        userId,
        email,
        businessId,
        businessName: business?.name || null,
        grantedPlan,
        grantType:
          asString(row.grant_type) === "temporary" ? "temporary" : "permanent",
        startsAt: asString(row.starts_at),
        grantedAt: asString(row.created_at),
        expiresAt: asString(row.expires_at),
        isActive: asBoolean(row.is_active),
        grantedBy: asString(row.granted_by),
        reason: asString(row.reason),
        createdAt: asString(row.created_at),
        updatedAt: asString(row.updated_at),
        status,
        effectivePlan,
        appliesNow: status === "active" && effectivePlan === grantedPlan,
        storedPlan,
        scopeLabel: businessId
          ? `${business?.name || "Business"} (${businessId})`
          : "Account-wide",
      } satisfies PlanGrantListItem;
    })
  );

  if (process.env.NODE_ENV !== "production") {
    console.info("[plan-grants] admin load", {
      count: hydrated.length,
      active: hydrated.filter((grant) => grant.status === "active").length,
    });
  }

  return hydrated;
}

export async function getActivePlanGrantList() {
  const history = await getPlanGrantHistoryList();
  return history.filter((grant) => grant.status === "active");
}
