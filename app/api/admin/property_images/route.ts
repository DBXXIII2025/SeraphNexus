import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient(); // ✅ MUST await

    const body = await req.json();
    const { property_id, image_url } = body;

    // 1. Get user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 🔥 FORCE TABLE TYPES
    const businessesTable = supabase.from("businesses") as any;
    const propertyTable = supabase.from("property") as any;
    const imagesTable = supabase.from("property_images") as any;

    // 2. Get business
    const { data: businessData } = await businessesTable
      .select("id")
      .eq("owner_id", user.id)
      .single();

    const business = businessData as { id: string } | null;

    if (!business) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    // 3. Validate property
    const { data: property } = await propertyTable
      .select("id")
      .eq("id", property_id)
      .eq("business_id", business.id)
      .single();

    if (!property) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 }
      );
    }

    // 4. Insert image
    const { data, error } = await imagesTable
      .insert({
        property_id,
        business_id: business.id,
        image_url,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to add image" },
        { status: 500 }
      );
    }

    return NextResponse.json({ image: data });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
