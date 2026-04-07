import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getIsPlatformAdminForUserId } from "@/lib/platformAdmin";

function normalizeEmail(value: FormDataEntryValue | null) {
  return String(value || "").trim().toLowerCase();
}

function normalizeOptionalString(value: FormDataEntryValue | null) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function buildRedirect(req: Request, params: Record<string, string>) {
  const url = new URL("/admin/platform", req.url);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return NextResponse.redirect(url);
}

function resolveExpiresAt(formData: FormData) {
  const grantType = String(formData.get("grant_type") || "").trim();
  if (grantType !== "temporary") {
    return { expiresAt: null, error: null as string | null };
  }

  const preset = String(formData.get("duration_preset") || "").trim();
  const customExpiresAt = normalizeOptionalString(formData.get("custom_expires_at"));
  const now = new Date();

  if (preset === "7d" || preset === "14d" || preset === "30d") {
    const days = Number.parseInt(preset.replace("d", ""), 10);
    if (Number.isFinite(days) && days > 0) {
      return {
        expiresAt: new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString(),
        error: null as string | null,
      };
    }
  }

  if (!customExpiresAt) {
    return { expiresAt: null, error: "temporary-expiry-required" };
  }

  const parsed = new Date(customExpiresAt);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= now.getTime()) {
    return { expiresAt: null, error: "invalid-custom-expiry" };
  }

  return {
    expiresAt: parsed.toISOString(),
    error: null as string | null,
  };
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !(await getIsPlatformAdminForUserId(user.id))) {
      return buildRedirect(req, { error: "forbidden" });
    }

    const formData = await req.formData();
    const action = String(formData.get("action") || "").trim();
    const supabaseAdmin = createAdminClient();
    const grantedBy = user.email || user.id;

    if (action === "create_plan_grant") {
      const email = normalizeEmail(formData.get("email"));
      const businessId = normalizeOptionalString(formData.get("business_id"));
      const grantedPlan = String(formData.get("granted_plan") || "").trim();
      const grantType = String(formData.get("grant_type") || "").trim();
      const reason = normalizeOptionalString(formData.get("reason"));

      if (!email) {
        return buildRedirect(req, { error: "plan-grant-email-required" });
      }

      if (grantedPlan !== "pro" && grantedPlan !== "elite") {
        return buildRedirect(req, { error: "granted-plan-required" });
      }

      if (grantType !== "temporary" && grantType !== "permanent") {
        return buildRedirect(req, { error: "grant-type-required" });
      }

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id,email")
        .eq("email", email)
        .maybeSingle();

      if (!profile?.id) {
        return buildRedirect(req, { error: "plan-grant-user-not-found" });
      }

      const { expiresAt, error } = resolveExpiresAt(formData);
      if (error) {
        return buildRedirect(req, { error });
      }

      const nowIso = new Date().toISOString();
      const { error: insertError } = await supabaseAdmin.from("plan_grants").insert({
        user_id: profile.id,
        business_id: businessId,
        granted_plan: grantedPlan,
        grant_type: grantType,
        starts_at: nowIso,
        expires_at: expiresAt,
        is_active: true,
        granted_by: grantedBy,
        reason,
        updated_at: nowIso,
      });

      if (insertError) {
        return buildRedirect(req, { error: "plan-grant-failed" });
      }

      return buildRedirect(req, { success: "plan-grant-created" });
    }

    if (action === "revoke_plan_grant") {
      const grantId = normalizeOptionalString(formData.get("grant_id"));

      if (!grantId) {
        return buildRedirect(req, { error: "plan-grant-id-required" });
      }

      const { error } = await supabaseAdmin
        .from("plan_grants")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", grantId);

      if (error) {
        return buildRedirect(req, { error: "plan-grant-revoke-failed" });
      }

      return buildRedirect(req, { success: "plan-grant-revoked" });
    }

    return buildRedirect(req, { error: "unknown-plan-grant-action" });
  } catch (error) {
    console.error("[admin/platform/plan-grants] failed", error);
    return buildRedirect(req, { error: "unexpected" });
  }
}
