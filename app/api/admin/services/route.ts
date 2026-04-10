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

function normalizeText(value: FormDataEntryValue | null, maxLength = 5000) {
  const text = String(value || "").trim();
  return text ? text.slice(0, maxLength) : null;
}

function normalizePrice(value: FormDataEntryValue | null) {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price : null;
}

function normalizeDuration(value: FormDataEntryValue | null) {
  const duration = Number(value);
  return Number.isFinite(duration) && duration > 0 ? duration : 30;
}

function nowIso() {
  return new Date().toISOString();
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const formData = await req.formData();

  const action = String(formData.get("action") || "save").trim();
  const serviceId = String(formData.get("id") || "").trim();
  const businessId = String(formData.get("business_id") || "").trim();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return buildRedirect(req, { error: "unauthorized" });
  }

  if (!businessId) {
    return buildRedirect(req, { error: "missing-business" });
  }

  const businessesTable = supabase.from("businesses") as any;
  const servicesTable = supabase.from("services") as any;
  const serviceImagesTable = supabase.from("service_images") as any;
  const checkoutIntentsTable = supabase.from("checkout_intents") as any;

  const { data: business, error: businessError } = await businessesTable
    .select("id, owner_id, plan")
    .eq("id", businessId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (businessError || !business?.id) {
    return buildRedirect(req, { error: "missing-business" });
  }

  if (action === "save") {
    const name = normalizeText(formData.get("name"), 200);
    const description = normalizeText(formData.get("description"));
    const category = normalizeText(formData.get("category"), 200);
    const price = normalizePrice(formData.get("price"));
    const duration = normalizeDuration(formData.get("duration"));

    if (!name || price === null) {
      return buildRedirect(req, { error: "invalid-service" });
    }

    if (serviceId) {
      const { error } = await servicesTable
        .update({
          name,
          description,
          category,
          price,
          duration,
          updated_at: nowIso(),
        })
        .eq("id", serviceId)
        .eq("business_id", business.id);

      if (error) {
        return buildRedirect(req, { error: "save-failed" });
      }

      return buildRedirect(req, { success: "updated" });
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

    const { count, error: countError } = await servicesTable
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

    const { error } = await servicesTable.insert({
      business_id: business.id,
      name,
      description,
      category,
      price,
      duration,
      is_active: true,
      archived_at: null,
      updated_at: nowIso(),
    });

    if (error) {
      return buildRedirect(req, { error: "save-failed" });
    }

    return buildRedirect(req, { success: "created" });
  }

  if (!serviceId) {
    return buildRedirect(req, { error: "invalid-service" });
  }

  const { data: service } = await servicesTable
    .select("id, business_id, is_active")
    .eq("id", serviceId)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!service?.id) {
    return buildRedirect(req, { error: "service-not-found" });
  }

  if (action === "archive" || action === "restore") {
    const nextActive = action === "restore";
    const { error } = await servicesTable
      .update({
        is_active: nextActive,
        archived_at: nextActive ? null : nowIso(),
        updated_at: nowIso(),
      })
      .eq("id", serviceId)
      .eq("business_id", business.id);

    if (error) {
      return buildRedirect(req, { error: "service-state-failed" });
    }

    return buildRedirect(req, { success: nextActive ? "restored" : "archived" });
  }

  if (action === "delete") {
    const { count: dependencyCount, error: dependencyError } = await checkoutIntentsTable
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("service_id", serviceId);

    if (dependencyError) {
      return buildRedirect(req, { error: "service-dependency-check-failed" });
    }

    if (Number(dependencyCount || 0) > 0) {
      const { error } = await servicesTable
        .update({
          is_active: false,
          archived_at: nowIso(),
          updated_at: nowIso(),
        })
        .eq("id", serviceId)
        .eq("business_id", business.id);

      if (error) {
        return buildRedirect(req, { error: "service-archive-failed" });
      }

      return buildRedirect(req, { success: "archived" });
    }

    await serviceImagesTable.delete().eq("service_id", serviceId).eq("business_id", business.id);

    const { error } = await servicesTable
      .delete()
      .eq("id", serviceId)
      .eq("business_id", business.id);

    if (error) {
      return buildRedirect(req, { error: "service-delete-failed" });
    }

    return buildRedirect(req, { success: "deleted" });
  }

  return buildRedirect(req, { error: "unsupported-action" });
}
