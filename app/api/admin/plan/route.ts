import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isPlanTier } from "@/lib/planConfig";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const body = await req.json();
    const businessId =
      typeof body?.businessId === "string" ? body.businessId.trim() : "";
    const plan = body?.plan;

    if (!businessId || !isPlanTier(plan) || (plan !== "pro" && plan !== "elite")) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("id", businessId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("businesses")
      .update({ plan })
      .eq("id", business.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, plan });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to update plan" },
      { status: 500 }
    );
  }
}
