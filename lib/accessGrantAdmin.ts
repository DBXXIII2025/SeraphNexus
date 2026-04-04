import { createAdminClient } from "@/lib/supabase/server";
import { normalizeAccessPlan, type AccessPlan } from "@/lib/accessPlan";

type LooseRow = Record<string, unknown>;

export type AccessGrantListItem = {
  id: string;
  userId: string | null;
  email: string | null;
  businessId: string | null;
  businessName: string | null;
  plan: AccessPlan;
  grantedBy: string | null;
  grantedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  inviteToken: string | null;
  activatedAt: string | null;
};

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asBoolean(value: unknown) {
  return value === true;
}

export async function getActiveAccessGrantList() {
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("access_grants")
    .select("*")
    .eq("is_active", true)
    .order("granted_at", { ascending: false });

  if (error) {
    console.error("[access-grants] load failed", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return [] as AccessGrantListItem[];
  }

  const rows = (data || []) as LooseRow[];
  const businessIds = rows
    .map((row) => asString(row.business_id))
    .filter((value): value is string => Boolean(value));

  const businessNameById = new Map<string, string>();
  if (businessIds.length > 0) {
    const { data: businesses } = await supabaseAdmin
      .from("businesses")
      .select("id,name")
      .in("id", businessIds);

    ((businesses || []) as LooseRow[]).forEach((business) => {
      const id = asString(business.id);
      if (id) {
        businessNameById.set(id, asString(business.name) || "Business");
      }
    });
  }

  return rows.map((row) => {
    const businessId = asString(row.business_id);
    return {
      id: String(row.id || ""),
      userId: asString(row.user_id),
      email: asString(row.email),
      businessId,
      businessName: businessId ? businessNameById.get(businessId) || null : null,
      plan: normalizeAccessPlan(row.plan),
      grantedBy: asString(row.granted_by),
      grantedAt: asString(row.granted_at),
      expiresAt: asString(row.expires_at),
      isActive: asBoolean(row.is_active),
      inviteToken: asString(row.invite_token),
      activatedAt: asString(row.activated_at),
    } satisfies AccessGrantListItem;
  });
}
