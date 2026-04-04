import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const PLATFORM_ADMIN_HOME = "/platform-admin";

type PlatformAdminProfile = {
  id: string;
  email: string | null;
  is_platform_admin: boolean | null;
};

async function getProfileForUserId(userId: string | null | undefined) {
  if (!userId) {
    return null;
  }

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,email,is_platform_admin")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[platform-admin] profile lookup failed", {
      userId,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return null;
  }

  return (data as PlatformAdminProfile | null) || null;
}

export async function getIsPlatformAdminForUserId(
  userId: string | null | undefined
) {
  const profile = await getProfileForUserId(userId);
  return profile?.is_platform_admin === true;
}

export async function getPlatformAdminSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = await getProfileForUserId(user?.id);

  return {
    supabase,
    user,
    profile,
    isPlatformAdmin: profile?.is_platform_admin === true,
  };
}

export async function requirePlatformAdminPage() {
  const session = await getPlatformAdminSession();

  if (!session.user) {
    redirect(`/login?next=${encodeURIComponent(PLATFORM_ADMIN_HOME)}`);
  }

  if (!session.isPlatformAdmin) {
    redirect("/admin");
  }

  return session;
}
