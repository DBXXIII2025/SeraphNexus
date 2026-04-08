import { NextResponse } from "next/server";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { createClient } from "@/lib/supabase/server";

function normalizeRequiredId(value: unknown) {
  const id = typeof value === "string" ? value.trim() : "";
  return id.length > 0 ? id : null;
}

function normalizeImageUrl(value: unknown) {
  const imageUrl = typeof value === "string" ? value.trim() : "";
  return imageUrl.length > 0 ? imageUrl : null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const propertyId = normalizeRequiredId(body?.property_id);
    const imageUrl = normalizeImageUrl(body?.image_url);

    if (!propertyId || !imageUrl) {
      return NextResponse.json(
        { error: "property_id and image_url are required" },
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
      .from("property_images")
      .insert({
        property_id: propertyId,
        business_id: business.id,
        image_url: imageUrl,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to add image" }, { status: 500 });
    }

    return NextResponse.json({ image: data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add image" },
      { status: 500 }
    );
  }
}
