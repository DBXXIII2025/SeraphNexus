import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { findAuthUserByEmail } from "@/lib/adminAuthUsers";
import {
  replaceStoredPlanGrantForScope,
  revokeStoredPlanGrantById,
} from "@/lib/manualPlanGrantStorage";
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

function revalidateGrantViews() {
  revalidatePath("/admin/platform");
  revalidatePath("/admin");
  revalidatePath("/admin/businesses");
  revalidatePath("/admin/revenue");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/upgrade");
}

function resolveExpiresAt(formData: FormData) {
  const grantType = String(formData.get("grant_type") || "").trim();
  const preset = String(formData.get("duration_preset") || "").trim();
  const customExpiresAt = normalizeOptionalString(formData.get("custom_expires_at"));
  const now = new Date();

  if (grantType === "permanent") {
    if (customExpiresAt) {
      return { expiresAt: null, error: "permanent-expiry-not-allowed" as string | null };
    }

    return { expiresAt: null, error: null as string | null };
  }

  if (grantType !== "temporary") {
    return { expiresAt: null, error: "grant-type-required" as string | null };
  }

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
    return { expiresAt: null, error: "temporary-expiry-required" as string | null };
  }

  const parsed = new Date(customExpiresAt);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= now.getTime()) {
    return { expiresAt: null, error: "invalid-custom-expiry" as string | null };
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

      const authUser = await findAuthUserByEmail(email);

      if (!authUser?.id) {
        return buildRedirect(req, { error: "plan-grant-user-not-found" });
      }

      const { expiresAt, error } = resolveExpiresAt(formData);
      if (error) {
        return buildRedirect(req, { error });
      }

      let validatedBusinessId: string | null = null;
      if (businessId) {
        const { data: business } = await supabaseAdmin
          .from("businesses")
          .select("id,name,owner_id")
          .eq("id", businessId)
          .maybeSingle();

        if (!business?.id) {
          return buildRedirect(req, { error: "plan-grant-business-not-found" });
        }

        if (String(business.owner_id || "") !== String(authUser.id)) {
          return buildRedirect(req, { error: "plan-grant-business-owner-mismatch" });
        }

        validatedBusinessId = String(business.id);
      }

      const nowIso = new Date().toISOString();

      const replaceGrantResult = await replaceStoredPlanGrantForScope({
        userId: authUser.id,
        businessId: validatedBusinessId,
        grantedPlan: grantedPlan as "pro" | "elite",
        grantType: grantType as "temporary" | "permanent",
        startsAt: nowIso,
        expiresAt,
        grantedBy,
        reason,
      });

      if (replaceGrantResult.error || !replaceGrantResult.data?.id) {
        return buildRedirect(req, { error: "plan-grant-failed" });
      }

      console.info("[admin/platform/plan-grants] created", {
        grantId: replaceGrantResult.data.id,
        targetUserId: authUser.id,
        email,
        businessId: validatedBusinessId,
        grantedPlan,
        grantType,
        expiresAt,
        grantedBy,
      });

      revalidateGrantViews();
      return buildRedirect(req, { success: "plan-grant-created" });
    }

    if (action === "revoke_plan_grant") {
      const grantId = normalizeOptionalString(formData.get("grant_id"));

      if (!grantId) {
        return buildRedirect(req, { error: "plan-grant-id-required" });
      }

      const { error } = await revokeStoredPlanGrantById({
        grantId,
        revokedAt: new Date().toISOString(),
      });

      if (error) {
        return buildRedirect(req, { error: "plan-grant-revoke-failed" });
      }

      console.info("[admin/platform/plan-grants] revoked", {
        grantId,
        revokedBy: grantedBy,
      });

      revalidateGrantViews();
      return buildRedirect(req, { success: "plan-grant-revoked" });
    }

    return buildRedirect(req, { error: "unknown-plan-grant-action" });
  } catch (error) {
    console.error("[admin/platform/plan-grants] failed", error);
    return buildRedirect(req, { error: "unexpected" });
  }
}
