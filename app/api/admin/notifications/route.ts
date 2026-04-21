import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { markAllNotificationsReadForUser, markNotificationReadForUser } from "@/lib/notifications";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/admin/notifications", req.url));
  }

  const formData = await req.formData();
  const action = String(formData.get("action") || "").trim();
  const notificationId = String(formData.get("notification_id") || "").trim();
  const redirectTo =
    String(formData.get("redirect_to") || "/admin/notifications").trim() || "/admin/notifications";

  if (action === "mark_all_read") {
    await markAllNotificationsReadForUser(user.id);
    return NextResponse.redirect(new URL(redirectTo, req.url));
  }

  if (action === "mark_read" && notificationId) {
    await markNotificationReadForUser(user.id, notificationId);
  }

  return NextResponse.redirect(new URL(redirectTo, req.url));
}
