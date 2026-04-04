import { NextResponse } from "next/server";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { normalizeBusinessSlug } from "@/lib/businessProfileCompletion";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const body = await req.json();

    const name = String(body?.name || "").trim();
    const description = String(body?.description || "").trim();
    const requestedSlug = String(body?.slug || "").trim();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activeBusiness = await getActiveBusiness();
    if (!activeBusiness || activeBusiness.owner_id !== user.id) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

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

    const { data, error } = await businessesTable
      .update({
        name,
        slug: nextSlug,
        description: description || null,
      })
      .eq("id", activeBusiness.id)
      .eq("owner_id", user.id)
      .select("id, name, slug, description, business_type")
      .single();

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
