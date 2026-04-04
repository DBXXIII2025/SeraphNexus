import { randomUUID } from "crypto";
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

    if (action === "grant_trial") {
      const email = normalizeEmail(formData.get("email"));
      const businessId = normalizeOptionalString(formData.get("business_id"));
      const expiresAt = normalizeOptionalString(formData.get("expires_at"));

      if (!email) {
        return buildRedirect(req, { error: "grant-email-required" });
      }

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id,email")
        .eq("email", email)
        .maybeSingle();

      if (!profile?.id) {
        return buildRedirect(req, { error: "grant-user-not-found" });
      }

      const { error } = await supabaseAdmin.from("access_grants").insert({
        user_id: profile.id,
        email,
        business_id: businessId,
        plan: "trial",
        granted_by: grantedBy,
        expires_at: expiresAt,
        is_active: true,
      });

      if (error) {
        return buildRedirect(req, { error: "grant-failed" });
      }

      return buildRedirect(req, { success: "trial-granted" });
    }

    if (action === "create_invite") {
      const email = normalizeEmail(formData.get("email"));
      const businessId = normalizeOptionalString(formData.get("business_id"));
      const expiresAt = normalizeOptionalString(formData.get("expires_at"));

      if (!email) {
        return buildRedirect(req, { error: "invite-email-required" });
      }

      const inviteToken = randomUUID().replace(/-/g, "");
      const { error } = await supabaseAdmin.from("access_grants").insert({
        email,
        business_id: businessId,
        plan: "trial",
        granted_by: grantedBy,
        expires_at: expiresAt,
        is_active: true,
        invite_token: inviteToken,
      });

      if (error) {
        return buildRedirect(req, { error: "invite-create-failed" });
      }

      return buildRedirect(req, { success: "invite-created" });
    }

    if (action === "revoke_grant") {
      const grantId = normalizeOptionalString(formData.get("grant_id"));

      if (!grantId) {
        return buildRedirect(req, { error: "grant-id-required" });
      }

      const { error } = await supabaseAdmin
        .from("access_grants")
        .update({ is_active: false })
        .eq("id", grantId);

      if (error) {
        return buildRedirect(req, { error: "revoke-failed" });
      }

      return buildRedirect(req, { success: "grant-revoked" });
    }

    return buildRedirect(req, { error: "unknown-action" });
  } catch (error) {
    console.error("[admin/platform/access-grants] failed", error);
    return buildRedirect(req, { error: "unexpected" });
  }
}
