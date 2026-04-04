import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendBookingSMS } from "@/lib/sms";
import { applyVisibleFilter } from "@/lib/transactionVisibility";

const supabase = createAdminClient();

export async function GET(req: Request) {
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const dateStr = in24h.toISOString().slice(0, 10);

  const { data: bookings, error } = await applyVisibleFilter(
    supabase
      .from("bookings")
      .select("id, date, start_time, phone")
      .eq("status", "confirmed")
      .eq("reminder_sent", false)
      .eq("date", dateStr)
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  for (const booking of bookings ?? []) {
    if (booking.phone) {
      await sendBookingSMS(
        booking.phone,
        `Reminder: Your booking is tomorrow (${booking.date} ${booking.start_time}).`
      );
    }

    await supabase
      .from("bookings")
      .update({ reminder_sent: true })
      .eq("id", booking.id);
  }

  return NextResponse.json({
    success: true,
    reminders_sent: bookings?.length ?? 0,
  });
}
