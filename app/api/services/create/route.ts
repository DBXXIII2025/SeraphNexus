import { NextResponse } from "next/server";
import { resolveAccessPlanForBusiness } from "@/lib/accessGrants";
import { getUsageLimitResult } from "@/lib/planEnforcement";
import { createClient } from "@/lib/supabase/server";

function buildRedirect(req: Request, params: Record<string, string>) {
  const url = new URL("/admin/services", req.url);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return NextResponse.redirect(url);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const formData = await req.formData();

  const name = String(formData.get("name") || "").trim();
  const price = Number(formData.get("price"));
  const duration = Number(formData.get("duration") || 30);
  const businessId = String(formData.get("business_id") || "").trim();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return buildRedirect(req, { error: "unauthorized" });
  }

  if (!name || !Number.isFinite(price) || price <= 0 || !businessId) {
    return buildRedirect(req, { error: "invalid-service" });
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, owner_id, plan")
    .eq("id", businessId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (businessError || !business?.id) {
    return buildRedirect(req, { error: "missing-business" });
  }

  const effectivePlan = await resolveAccessPlanForBusiness({
    business: {
      id: business.id,
      owner_id: business.owner_id || null,
      plan: business.plan || null,
    },
    userId: user.id,
    email: user.email || null,
  });

  const { count, error: countError } = await supabase
    .from("services")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id);

  if (countError) {
    return buildRedirect(req, { error: "service-limit-check-failed" });
  }

  const serviceLimit = getUsageLimitResult({
    plan: effectivePlan,
    limitKey: "max_services",
    current: Number(count || 0),
  });

  if (!serviceLimit.allowed) {
    return buildRedirect(req, { error: "service-limit" });
  }

  const { error } = await supabase.from("services").insert({
    name,
    price,
    duration: Number.isFinite(duration) && duration > 0 ? duration : 30,
    business_id: business.id,
  });

  if (error) {
    console.error("CREATE SERVICE ERROR:", error);
    return buildRedirect(req, { error: "save-failed" });
  }

  return buildRedirect(req, { success: "created" });
}
