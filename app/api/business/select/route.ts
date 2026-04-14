import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getBusinessStaffRole } from "@/lib/businessStaff";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { businessId } = await req.json();

  if (!businessId) {
    return NextResponse.json({ error: "Missing businessId" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: ownedBusiness, error } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!ownedBusiness?.id) {
    const staffRole = await getBusinessStaffRole({
      businessId,
      userId: user.id,
    });

    if (!staffRole) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const cookieStore = await cookies();

  cookieStore.set("active_business_id", businessId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return NextResponse.json({ success: true });
}
