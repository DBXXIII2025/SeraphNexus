import { NextResponse } from "next/server";
import { getFeatureGate } from "@/lib/planEnforcement";
import { normalizeBusinessPlan } from "@/lib/planConfig";
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
      .select("id, business_id, date, start_time, phone")
      .eq("status", "confirmed")
      .eq("reminder_sent", false)
      .eq("date", dateStr)
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const businessIds = Array.from(
    new Set((bookings || []).map((booking) => String(booking.business_id || "")).filter(Boolean))
  );
  const { data: businessRows } =
    businessIds.length > 0
      ? await supabase.from("businesses").select("id, plan").in("id", businessIds)
      : { data: [] as Array<{ id: string; plan: string | null }> };

  const automationEnabledBusinessIds = new Set(
    ((businessRows || []) as Array<{ id: string; plan: string | null }>).flatMap((business) =>
      getFeatureGate(normalizeBusinessPlan(business.plan), "automation").allowed
        ? [String(business.id)]
        : []
    )
  );

  for (const booking of (bookings || []).filter((booking) =>
    automationEnabledBusinessIds.has(String(booking.business_id || ""))
  )) {
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
    reminders_sent: (bookings || []).filter((booking) =>
      automationEnabledBusinessIds.has(String(booking.business_id || ""))
    ).length,
  });
}
