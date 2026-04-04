import { createClient } from "@/lib/supabase/server";
import GuestCalendar from "./GuestCalendar";

export default async function AvailabilityPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("bookings")
    .select("date, start_time, end_time")
    .neq("status", "cancelled");

  return <GuestCalendar bookings={data ?? []} />;
}
