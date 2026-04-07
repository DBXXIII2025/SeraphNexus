import { createAdminClient } from "@/lib/supabase/server";

function normalizeEmail(value: string | null | undefined) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function findAuthUserByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const supabaseAdmin = createAdminClient();
  let page = 1;
  const perPage = 200;

  while (page <= 20) {
    const result = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    const users = result.data?.users || [];
    const match =
      users.find((user) => normalizeEmail(user.email || null) === normalizedEmail) || null;

    if (match) {
      return {
        id: match.id,
        email: normalizeEmail(match.email || null) || null,
      };
    }

    if (users.length < perPage) {
      break;
    }

    page += 1;
  }

  return null;
}

export async function getAuthUserEmailsByIds(userIds: string[]) {
  const supabaseAdmin = createAdminClient();
  const emailByUserId = new Map<string, string>();

  await Promise.all(
    Array.from(new Set(userIds.filter(Boolean))).map(async (userId) => {
      const result = await supabaseAdmin.auth.admin.getUserById(userId);
      const email = normalizeEmail(result.data.user?.email || null);
      if (email) {
        emailByUserId.set(userId, email);
      }
    })
  );

  return emailByUserId;
}
