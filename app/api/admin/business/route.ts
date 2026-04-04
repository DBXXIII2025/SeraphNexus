import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness } from "@/lib/getBusiness";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await getCurrentBusiness();
  return Response.json({ business });
}
