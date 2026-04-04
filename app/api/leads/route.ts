import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePlan } from "@/lib/planGuardServer";

export async function GET() {
  const guard = await requirePlan("leads");

  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.error },
      { status: guard.status }
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lead_events")
    .select("*")
    .eq("business_id", guard.business.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ data });
}
