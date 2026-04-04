import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isRentalBusinessType } from "@/lib/businessModules";
import { applyVisibleFilter } from "@/lib/transactionVisibility";

export async function GET() {
  try {
    const supabase = await createClient();

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
    const bookingsTable = supabase.from("bookings") as any;
    const reservationsTable = supabase.from("rental_reservations") as any;

    // 2. Get business
    const { data: businessData } = await businessesTable
      .select("id, business_type")
      .eq("owner_id", user.id)
      .single();

    const business = businessData as { id: string; business_type?: string | null } | null;

    if (!business) {
      return NextResponse.json(
        { error: "No business found" },
        { status: 404 }
      );
    }

    // 3. Get bookings
    const isRental = isRentalBusinessType(business.business_type);
    const { data: bookings, error } = await applyVisibleFilter(
      (isRental ? reservationsTable : bookingsTable)
        .select("*")
        .eq("business_id", business.id)
        .order(isRental ? "check_in_date" : "created_at", { ascending: false })
    );

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch bookings" },
        { status: 500 }
      );
    }

    return NextResponse.json({ bookings, isRental });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
