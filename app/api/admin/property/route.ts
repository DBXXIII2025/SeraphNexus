import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    // ✅ FIX: await client
    const supabase = await createClient();

    const body = await req.json();
    const { name, price } = body;

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

    // 3. Create property
    const { data, error } = await propertyTable
      .insert({
        name,
        price,
        business_id: business.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to create property" },
        { status: 500 }
      );
    }

    return NextResponse.json({ property: data });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
