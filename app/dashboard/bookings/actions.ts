"use server";

import { createClient } from "@/lib/supabase/server";

export async function updateBookingStatus(
  bookingId: string,
  status: "confirmed" | "rejected"
) {
  const supabase = await createClient();

  const bookingsTable = supabase.from("bookings") as any;

  const { error } = await bookingsTable
    .update({ status })
    .eq("id", bookingId);

  if (error) {
    throw new Error("Failed to update booking");
  }
}
