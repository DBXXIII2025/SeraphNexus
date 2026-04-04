import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function buildError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const inviteToken =
      typeof body?.inviteToken === "string" ? body.inviteToken.trim() : "";
    const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
    const email = normalizeEmail(body?.email);

    if (!inviteToken || !userId || !email) {
      return buildError("Invite token, user, and email are required.");
    }

    const supabaseAdmin = createAdminClient();
    const userLookup = await supabaseAdmin.auth.admin.getUserById(userId);
    const authEmail = normalizeEmail(userLookup.data.user?.email || null);

    if (!userLookup.data.user || authEmail !== email) {
      return buildError("Invite activation could not verify this account.");
    }

    const { data: grant, error } = await supabaseAdmin
      .from("access_grants")
      .select("*")
      .eq("invite_token", inviteToken)
      .eq("email", email)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !grant) {
      return buildError("Invite token is invalid or no longer available.");
    }

    if (grant.expires_at) {
      const expiresAt = new Date(grant.expires_at).getTime();
      if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
        return buildError("Invite token has expired.");
      }
    }

    if (grant.user_id && grant.user_id !== userId) {
      return buildError("Invite token has already been activated.");
    }

    const { error: updateError } = await supabaseAdmin
      .from("access_grants")
      .update({
        user_id: userId,
        invite_token: null,
        activated_at: new Date().toISOString(),
      })
      .eq("id", grant.id);

    if (updateError) {
      return buildError("Invite activation failed.", 500);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[auth/access-grants/activate-invite] failed", error);
    return buildError("Invite activation failed.", 500);
  }
}
