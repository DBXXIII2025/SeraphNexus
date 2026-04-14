import { NextResponse } from "next/server";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { canAccessPlanFeature } from "@/lib/planConfig";
import { createAdminClient } from "@/lib/supabase/server";

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
  const business = await getActiveBusiness();

  if (!business?.id || !business.owner_id) {
    return redirectWith(req, { message: "missing-business" });
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

    const { error } = await supabase.from("business_staff_members").upsert(
      {
        business_id: business.id,
        owner_id: business.owner_id,
        email,
        role,
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id,email" }
    );

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
      .update({
        status: "inactive",
        updated_at: new Date().toISOString(),
      })
      .eq("id", staffId)
      .eq("business_id", business.id)
      .eq("owner_id", business.owner_id);

    if (error) {
      console.error("[admin/team] deactivate failed", error);
      return redirectWith(req, { error: "team-member-save-failed" });
    }

    return redirectWith(req, { message: "team-member-deactivated" });
  }

  return redirectWith(req, { error: "team-member-invalid" });
}
