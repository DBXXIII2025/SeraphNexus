import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getTenantAdminHomeRoute } from "@/lib/tenantRouting";

export async function POST(req: Request) {
  const { businessId } = await req.json();

  if (!businessId) {
    return Response.json({ error: "Missing businessId" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: ownedBusiness, error } = await supabase
    .from("businesses")
    .select(
      "id, owner_id, name, slug, description, business_type, stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled, stripe_payouts_enabled, is_published"
    )
    .eq("id", businessId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[set-active-business] ownership lookup failed", {
      userId: user.id,
      businessId,
      message: error.message,
    });
    return Response.json({ error: "Failed to switch business" }, { status: 500 });
  }

  if (!ownedBusiness?.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const cookieStore = await cookies();

  cookieStore.set("active_business_id", businessId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  const redirectTo = await getTenantAdminHomeRoute({
    business: ownedBusiness,
    userId: user.id,
  });

  return Response.json({ success: true, redirectTo });
}
