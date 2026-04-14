import { NextResponse } from "next/server";
import { resolveProfileIdByEmail } from "@/lib/businessStaff";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { canAccessPlanFeature } from "@/lib/planConfig";
import { createAdminClient, createClient } from "@/lib/supabase/server";

function redirectWith(req: Request, params: Record<string, string>) {
  const url = new URL("/admin/settings", req.url);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url);
}

function normalizeRole(value: FormDataEntryValue | null) {
  const role = String(value || "staff").trim();
  return role === "admin" || role === "manager" || role === "staff" ? role : null;
}

export async function POST(req: Request) {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  const business = await getActiveBusiness();

  if (!user || !business?.id || !business.owner_id) {
    return redirectWith(req, { message: "missing-business" });
  }

  const canManageTeam = business.owner_id === user.id || business.access_role === "admin";
  if (!canManageTeam) {
    return redirectWith(req, { error: "team-member-forbidden" });
  }

  if (!canAccessPlanFeature(business.plan, "team_roles")) {
    return redirectWith(req, { error: "team-roles-plan-locked" });
  }

  const formData = await req.formData();
  const action = String(formData.get("action") || "").trim();
  const supabase = createAdminClient();

  if (action === "add") {
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const role = normalizeRole(formData.get("role"));

    if (!email || !role) {
      return redirectWith(req, { error: "team-member-invalid" });
    }

    const staffUserId = await resolveProfileIdByEmail(email);
    if (!staffUserId || staffUserId === business.owner_id) {
      return redirectWith(req, { error: "team-member-invalid" });
    }

    const { data: existingMember, error: existingMemberError } = await supabase
      .from("business_staff_members")
      .select("id")
      .eq("business_id", business.id)
      .eq("user_id", staffUserId)
      .limit(1);

    if (existingMemberError) {
      console.error("[admin/team] lookup failed", existingMemberError);
      return redirectWith(req, { error: "team-member-save-failed" });
    }

    const existingMemberId = Array.isArray(existingMember) ? existingMember[0]?.id : null;

    const { error } = existingMemberId
      ? await supabase
          .from("business_staff_members")
          .update({ role })
          .eq("id", existingMemberId)
          .eq("business_id", business.id)
      : await supabase.from("business_staff_members").insert({
          business_id: business.id,
          user_id: staffUserId,
          role,
        });

    if (error) {
      console.error("[admin/team] add failed", error);
      return redirectWith(req, { error: "team-member-save-failed" });
    }

    return redirectWith(req, { message: "team-member-saved" });
  }

  if (action === "deactivate") {
    const staffId = String(formData.get("staff_id") || "").trim();
    if (!staffId) {
      return redirectWith(req, { error: "team-member-invalid" });
    }

    const { error } = await supabase
      .from("business_staff_members")
      .delete()
      .eq("id", staffId)
      .eq("business_id", business.id);

    if (error) {
      console.error("[admin/team] deactivate failed", error);
      return redirectWith(req, { error: "team-member-save-failed" });
    }

    return redirectWith(req, { message: "team-member-deactivated" });
  }

  return redirectWith(req, { error: "team-member-invalid" });
}
