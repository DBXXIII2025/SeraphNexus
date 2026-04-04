import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getIsPlatformAdminForUserId } from "@/lib/platformAdmin";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !(await getIsPlatformAdminForUserId(user.id))) {
      return NextResponse.redirect(new URL("/admin/platform", req.url));
    }

    const formData = await req.formData();
    const payload = {
      platform_name: String(formData.get("platform_name") || "").trim() || "Seraph Nexus",
      marketing_headline:
        String(formData.get("marketing_headline") || "").trim() ||
        "Operate bookings, orders, rentals, and client follow-up in one place.",
      marketing_subheadline:
        String(formData.get("marketing_subheadline") || "").trim() ||
        "Launch-ready business tools with Stripe Connect payouts, admin operations, and polished customer flows.",
      support_email:
        String(formData.get("support_email") || "").trim() || "support@seraphnexus.com",
      support_phone: String(formData.get("support_phone") || "").trim() || "(800) 555-0100",
      pricing_note:
        String(formData.get("pricing_note") || "").trim() ||
        "Choose the fee tier that matches your growth stage: Free 10%, Pro 5%, Elite 2%.",
    };

    const supabaseAdmin = createAdminClient();
    const { data: existing } = await supabaseAdmin
      .from("platform_settings")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      await supabaseAdmin.from("platform_settings").update(payload).eq("id", existing.id);
    } else {
      await supabaseAdmin.from("platform_settings").insert(payload);
    }

    return NextResponse.redirect(new URL("/admin/platform", req.url));
  } catch (err) {
    console.error("[admin/platform] failed:", err);
    return NextResponse.redirect(new URL("/admin/platform", req.url));
  }
}
