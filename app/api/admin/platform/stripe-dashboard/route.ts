import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getIsPlatformAdminForUserId } from "@/lib/platformAdmin";
import { getPlatformStripeEnvironmentSummary } from "@/lib/platformBilling";

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await getIsPlatformAdminForUserId(user.id))) {
    return NextResponse.redirect(new URL("/admin/platform?error=forbidden", req.url));
  }

  const stripeEnvironment = getPlatformStripeEnvironmentSummary();
  if (!stripeEnvironment.configured) {
    return NextResponse.redirect(
      new URL("/admin/platform?error=platform-stripe-not-configured", req.url)
    );
  }

  return NextResponse.redirect(stripeEnvironment.dashboardUrl);
}
