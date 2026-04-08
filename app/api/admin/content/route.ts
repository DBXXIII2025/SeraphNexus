import { NextResponse } from "next/server";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { createClient } from "@/lib/supabase/server";

function normalizeRequiredId(value: unknown) {
  const id = typeof value === "string" ? value.trim() : "";
  return id.length > 0 ? id : null;
}

function normalizeText(value: unknown, maxLength = 5000) {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();
  return text.length > 0 ? text.slice(0, maxLength) : null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const propertyId = normalizeRequiredId(body?.property_id);
    const title = normalizeText(body?.title, 255);
    const description = normalizeText(body?.description);

    if (!propertyId || !title || !description) {
      return NextResponse.json(
        { error: "property_id, title, and description are required" },
        { status: 400 }
      );
    }

    const business = await getActiveBusiness();
    if (!business) {
      return NextResponse.json({ error: "Active business not found" }, { status: 404 });
    }

    const supabase = await createClient();
    const { data: property, error: propertyError } = await supabase
      .from("property")
      .select("id")
      .eq("id", propertyId)
      .eq("business_id", business.id)
      .maybeSingle();

    if (propertyError || !property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("property_content")
      .upsert({
        property_id: propertyId,
        business_id: business.id,
        title,
        description,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to save content" }, { status: 500 });
    }

    return NextResponse.json({ content: data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save content" },
      { status: 500 }
    );
  }
}
