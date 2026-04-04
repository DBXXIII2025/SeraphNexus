import { createAdminClient, createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

type StartSearchParams = {
  businessId?: string;
};

export default async function StartConversationPage({
  searchParams,
}: {
  searchParams?: Promise<StartSearchParams>;
}) {
  const isDev = process.env.NODE_ENV !== "production";
  const params = searchParams ? await searchParams : undefined;
  const businessId = String(params?.businessId || "").trim();

  if (!businessId) {
    redirect("/explore");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const destination = `/messages?businessId=${encodeURIComponent(businessId)}`;

  const supabaseAdmin = createAdminClient();
  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id, name, owner_id, is_published")
    .eq("id", businessId)
    .maybeSingle();

  if (!business?.id || !business.is_published) {
    notFound();
  }

  void user;

  if (isDev) {
    console.log("[message-business] legacy start route redirect", {
      businessId,
      destination,
    });
  }

  redirect(destination);
}
