import { createClient } from "@/lib/supabase/server";
import GuestCalendar from "./GuestCalendar";
import { applyVisibleFilter } from "@/lib/transactionVisibility";

export default async function AvailabilityPage() {
  const supabase = await createClient();

  const { data } = await applyVisibleFilter(
    supabase
      .from("bookings")
      .select("date, start_time, end_time")
  );

  return <GuestCalendar bookings={data ?? []} />;
}
