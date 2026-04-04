import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildCancelledStatusUpdate } from "@/lib/transactionVisibility";

const ALLOWED_STATUSES = new Set(["confirmed", "cancelled"]);

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const formData = await req.formData();

    const id = String(formData.get("id") || "");
    const status = String(formData.get("status") || "");

    if (!id || !ALLOWED_STATUSES.has(status)) {
      return NextResponse.redirect(new URL("/admin/bookings", req.url));
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const bookingsTable = supabase.from("bookings") as any;
    const businessesTable = supabase.from("businesses") as any;

    const { data: booking } = await bookingsTable
      .select("id, business_id")
      .eq("id", id)
      .maybeSingle();

    if (!booking?.business_id) {
      return NextResponse.redirect(new URL("/admin/bookings", req.url));
    }

    const { data: business } = await businessesTable
      .select("id")
      .eq("id", booking.business_id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!business) {
      return NextResponse.redirect(new URL("/admin/bookings", req.url));
    }

    const payload =
      status === "cancelled"
        ? buildCancelledStatusUpdate("owner", "cancelled")
        : { status };

    await bookingsTable.update(payload).eq("id", id).eq("business_id", business.id);

    return NextResponse.redirect(new URL("/admin/bookings", req.url));
  } catch {
    return NextResponse.redirect(new URL("/admin/bookings?error=status", req.url));
  }
}
