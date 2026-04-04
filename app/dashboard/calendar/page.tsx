import { createClient } from "@/lib/supabase/server";

export default async function DashboardCalendarPage() {
  const supabase = await createClient();

  const bookingsTable = supabase.from("bookings") as any;

  const { data: bookings, error } = await bookingsTable.select("*");

  if (error) {
    return <div>Error loading calendar</div>;
  }

  const safeBookings = bookings ?? [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Calendar</h1>

      {safeBookings.length === 0 && <p>No bookings yet</p>}

      {safeBookings.map((b: any) => (
        <div key={b.id} className="border p-2 mb-2">
          {b.customer_email || "Customer"} - {b.date} {b.start_time}
        </div>
      ))}
    </div>
  );
}

