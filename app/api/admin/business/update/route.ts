import { NextResponse } from "next/server";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { normalizeBusinessSlug } from "@/lib/businessProfileCompletion";
import { createClient } from "@/lib/supabase/server";
import { normalizeBusinessPageTheme } from "@/lib/businessPageCustomization";
import {
  buildBusinessProfileUpdate,
  isMissingBusinessProfileColumns,
} from "@/lib/businessProfileFields";
import { resolveServiceCategoryForBusiness } from "@/lib/serviceCategories";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const body = await req.json();
    const requestedBusinessId = String(body?.businessId || body?.id || "").trim() || undefined;

    const name = String(body?.name || "").trim();
    const description = String(body?.description || "").trim();
    const requestedSlug = String(body?.slug || "").trim();
    const profileUpdate = buildBusinessProfileUpdate(body || {});
    const normalizedTheme = normalizeBusinessPageTheme({
      page_accent_color: body?.page_accent_color,
      page_text_color: body?.page_text_color,
      heading_font_size: body?.heading_font_size ?? body?.page_heading_font_size,
      body_font_size: body?.body_font_size ?? body?.page_body_font_size,
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activeBusiness = await getActiveBusiness(requestedBusinessId);
    if (!activeBusiness || activeBusiness.owner_id !== user.id) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const serviceCategory = resolveServiceCategoryForBusiness({
      businessType: String(body?.business_type || activeBusiness.business_type || "").trim(),
      value: body?.service_category,
    });
    const extendedProfileUpdate = {
      ...profileUpdate,
      service_category: serviceCategory,
    };

    const nextSlug = normalizeBusinessSlug(requestedSlug || name);
    if (!nextSlug) {
      return NextResponse.json(
        { error: "A valid business name or slug is required." },
        { status: 400 }
      );
    }

    const businessesTable = supabase.from("businesses");
    const { data: conflictingBusiness, error: conflictError } = await businessesTable
      .select("id")
      .eq("slug", nextSlug)
      .neq("id", activeBusiness.id)
      .maybeSingle();

    if (conflictError) {
      return NextResponse.json(
        { error: "Could not validate business slug." },
        { status: 500 }
      );
    }

    if (conflictingBusiness) {
      return NextResponse.json(
        { error: "That public slug is already in use." },
        { status: 409 }
      );
    }

    const baseUpdate = {
        name,
        slug: nextSlug,
        description: description || null,
        page_accent_color: normalizedTheme.accentColor,
        page_text_color: normalizedTheme.textColor,
        heading_font_size: normalizedTheme.headingFontSize,
        body_font_size: normalizedTheme.bodyFontSize,
      };

    const extendedSelect =
      "id, name, slug, description, business_type, page_accent_color, page_text_color, heading_font_size, body_font_size, phone, email, website, address, city, state, zip, country, social_facebook, social_instagram, social_twitter, hours_json, service_area";
    const baseSelect =
      "id, name, slug, description, business_type, page_accent_color, page_text_color, heading_font_size, body_font_size";

    let updateQuery = await businessesTable
      .update({
        ...baseUpdate,
        ...extendedProfileUpdate,
      })
      .eq("id", activeBusiness.id)
      .eq("owner_id", user.id)
      .select(extendedSelect)
      .single();

    if (updateQuery.error && isMissingBusinessProfileColumns(updateQuery.error)) {
      updateQuery = await businessesTable
        .update(baseUpdate)
        .eq("id", activeBusiness.id)
        .eq("owner_id", user.id)
        .select(baseSelect)
        .single();
    }

    const { data, error } = updateQuery;

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to update business" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, business: data });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update business" },
      { status: 500 }
    );
  }
}
