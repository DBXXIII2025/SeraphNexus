import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { findAuthUserByEmail } from "@/lib/adminAuthUsers";
import {
  getActivePlanGrantList,
  getPlanGrantHistoryList,
} from "@/lib/planGrantAdmin";
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

function wantsJson(req: Request) {
  const accept = req.headers.get("accept") || "";
  const requestedWith = req.headers.get("x-requested-with") || "";
  return (
    accept.includes("application/json") ||
    requestedWith.toLowerCase() === "xmlhttprequest"
  );
}

async function buildJsonSuccess(message: string) {
  const [activePlanGrants, planGrantHistory] = await Promise.all([
    getActivePlanGrantList(),
    getPlanGrantHistoryList(),
  ]);

  return NextResponse.json({
    ok: true,
    message,
    activePlanGrants,
    planGrantHistory,
  });
}

function buildJsonError(message: string, status = 400) {
  return NextResponse.json(
    {
      ok: false,
      message,
    },
    { status }
  );
}

function revalidateGrantViews() {
  revalidatePath("/admin/platform");
  revalidatePath("/admin");
  revalidatePath("/admin/businesses");
  revalidatePath("/admin/revenue");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/upgrade");
}

function getErrorMessage(error: string) {
  switch (error) {
    case "forbidden":
      return "Platform admin access is required.";
    case "plan-grant-email-required":
      return "An existing user email is required to grant a manual plan.";
    case "plan-grant-user-not-found":
      return "No existing account matched that email address for the manual grant.";
    case "granted-plan-required":
      return "Select Pro or Elite for the manual grant.";
    case "grant-type-required":
      return "Select whether the grant is temporary or permanent.";
    case "temporary-expiry-required":
      return "Temporary manual grants require a duration preset or a custom expiration date.";
    case "invalid-custom-expiry":
      return "Custom expiration must be a valid future date.";
    case "permanent-expiry-not-allowed":
      return "Permanent grants cannot include an expiration preset or custom expiry.";
    case "plan-grant-business-not-found":
      return "The selected business id could not be found.";
    case "plan-grant-business-owner-mismatch":
      return "That business is not owned by the selected account, so the grant would never apply.";
    case "plan-grant-failed":
      return "Manual plan grant could not be created.";
    case "plan-grant-id-required":
      return "A manual grant id is required to revoke access.";
    case "plan-grant-revoke-failed":
      return "Manual plan grant revocation failed.";
    case "unknown-plan-grant-action":
      return "Unknown manual plan grant action.";
    default:
      return "The manual plan grant action could not be completed.";
  }
}

function buildErrorResponse(req: Request, error: string, status = 400) {
  if (wantsJson(req)) {
    return buildJsonError(getErrorMessage(error), status);
  }

  return buildRedirect(req, { error });
}

async function buildSuccessResponse(req: Request, success: string) {
  if (wantsJson(req)) {
    const message =
      success === "plan-grant-created"
        ? "Manual plan grant created."
        : "Manual plan grant revoked.";
    return buildJsonSuccess(message);
  }

  return buildRedirect(req, { success });
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
      return buildErrorResponse(req, "forbidden", 403);
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
        return buildErrorResponse(req, "plan-grant-email-required");
      }

      if (grantedPlan !== "pro" && grantedPlan !== "elite") {
        return buildErrorResponse(req, "granted-plan-required");
      }

      if (grantType !== "temporary" && grantType !== "permanent") {
        return buildErrorResponse(req, "grant-type-required");
      }

      const authUser = await findAuthUserByEmail(email);

      if (!authUser?.id) {
        return buildErrorResponse(req, "plan-grant-user-not-found");
      }

      const { expiresAt, error } = resolveExpiresAt(formData);
      if (error) {
        return buildErrorResponse(req, error);
      }

      let validatedBusinessId: string | null = null;
      if (businessId) {
        const { data: business } = await supabaseAdmin
          .from("businesses")
          .select("id,name,owner_id")
          .eq("id", businessId)
          .maybeSingle();

        if (!business?.id) {
          return buildErrorResponse(req, "plan-grant-business-not-found");
        }

        if (String(business.owner_id || "") !== String(authUser.id)) {
          return buildErrorResponse(req, "plan-grant-business-owner-mismatch");
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
        return buildErrorResponse(req, "plan-grant-failed", 500);
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
      return buildSuccessResponse(req, "plan-grant-created");
    }

    if (action === "revoke_plan_grant") {
      const grantId = normalizeOptionalString(formData.get("grant_id"));

      if (!grantId) {
        return buildErrorResponse(req, "plan-grant-id-required");
      }

      const { error } = await revokeStoredPlanGrantById({
        grantId,
        revokedAt: new Date().toISOString(),
      });

      if (error) {
        return buildErrorResponse(req, "plan-grant-revoke-failed", 500);
      }

      console.info("[admin/platform/plan-grants] revoked", {
        grantId,
        revokedBy: grantedBy,
      });

      revalidateGrantViews();
      return buildSuccessResponse(req, "plan-grant-revoked");
    }

    return buildErrorResponse(req, "unknown-plan-grant-action");
  } catch (error) {
    console.error("[admin/platform/plan-grants] failed", error);
    return buildErrorResponse(req, "unexpected", 500);
  }
}
