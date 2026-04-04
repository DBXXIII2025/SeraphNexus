import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getIsPlatformAdminForUserId } from "@/lib/platformAdmin";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await getIsPlatformAdminForUserId(user.id))) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  return NextResponse.redirect(
    new URL(
      "/admin/platform?error=Cleanup%20is%20currently%20report-only.%20No%20business%20deletion%20is%20enabled.",
      req.url
    )
  );
}
