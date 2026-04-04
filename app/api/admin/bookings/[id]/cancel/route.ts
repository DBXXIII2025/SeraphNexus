import { NextResponse } from "next/server";
import { getOwnedBookingContext } from "@/lib/adminBookingOwnership";

type BookingsTable = {
  update: (payload: Record<string, unknown>) => {
    eq: (column: string, value: string) => {
      eq: (column2: string, value2: string) => Promise<{
        error: { message: string } | null;
      }>;
    };
  };
};

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await getOwnedBookingContext(id);

  if (access.shouldLogin) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (!access.authorized || !access.businessId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bookingsTable = access.supabase.from("bookings") as unknown as BookingsTable;
  const { error } = await bookingsTable
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("business_id", access.businessId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
