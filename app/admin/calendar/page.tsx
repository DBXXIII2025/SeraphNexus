import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { isRentalBusinessType } from "@/lib/businessModules";
import CalendarClient from "./CalendarClient";
import { applyVisibleFilter } from "@/lib/transactionVisibility";

export default async function AdminCalendarPage() {
  const supabase = await createClient();
  const business = await getActiveBusiness();

  if (!business) {
    return <div className="p-8 text-white">No active business</div>;
  }

  if (isRentalBusinessType(business.business_type)) {
    return (
      <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-6 text-white">
        Rental and property businesses use the dedicated reservations calendar in
        Inventory & Calendar.
      </div>
    );
  }

  if (business.business_type !== "service") {
    return (
      <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-6 text-white">
        Calendar view is only available for service businesses.
      </div>
    );
  }

  const { data: bookings, error } = await applyVisibleFilter(
    supabase
      .from("bookings")
      .select("id, date, start_time, end_time, customer_email, status")
      .eq("business_id", business.id)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true })
  );

  if (error) {
    return (
      <div className="p-8 text-red-600">
        Failed to load calendar.
      </div>
    );
  }

  console.log("[admin/calendar] service booking count:", {
    businessId: business.id,
    businessType: business.business_type || null,
    bookingCount: bookings?.length || 0,
  });

  return <CalendarClient bookings={bookings ?? []} />;
}
