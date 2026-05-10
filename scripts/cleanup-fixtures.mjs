import { createClient } from "@supabase/supabase-js";
import {
  FIXTURE_PREFIXES,
  assertFixtureEnvironment,
  filterFixtureBusinesses,
  hasFixturePrefix,
  isProtectedBusinessRecord,
  loadEnvLocal,
  requireEnv,
} from "./fixture-safety.mjs";

loadEnvLocal();

function createSupabaseAdmin() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

function safeEmailMatchesFixture(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  const localPart = normalized.split("@")[0] || "";
  return hasFixturePrefix(localPart) || hasFixturePrefix(normalized);
}

async function safeDelete(queryFactory, label, dryRun) {
  if (dryRun) {
    return;
  }

  const { error } = await queryFactory();
  if (error) {
    if (
      error.code === "42P01" ||
      error.code === "PGRST205" ||
      error.code === "42703"
    ) {
      return;
    }
    throw new Error(`${label}: ${error.message}`);
  }
}

async function listCandidateBusinesses(supabase) {
  const { data, error } = await supabase
    .from("businesses")
    .select("id,name,slug,owner_id")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return filterFixtureBusinesses(data).filter(
    (business) => !isProtectedBusinessRecord(business)
  );
}

async function cleanupFixtureUsers(supabase, ownerIds, dryRun) {
  if (ownerIds.length === 0) {
    return { deletedUserCount: 0, skippedPlatformAdminCount: 0 };
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,email,is_platform_admin")
    .in("id", ownerIds);

  const profileById = new Map(
    (profiles || []).map((profile) => [String(profile.id), profile])
  );

  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 500,
  });

  if (error) {
    throw error;
  }

  const users = data.users || [];
  const deletableUsers = users.filter((user) => {
    const profile = profileById.get(String(user.id));
    const isPlatformAdmin =
      profile?.is_platform_admin === true ||
      user.user_metadata?.is_platform_admin === true;

    if (isPlatformAdmin) {
      return false;
    }

    if (!ownerIds.includes(String(user.id))) {
      return false;
    }

    return safeEmailMatchesFixture(user.email || profile?.email || "");
  });

  const skippedPlatformAdminCount = ownerIds.filter((ownerId) => {
    const profile = profileById.get(ownerId);
    return profile?.is_platform_admin === true;
  }).length;

  if (!dryRun) {
    for (const user of deletableUsers) {
      const result = await supabase.auth.admin.deleteUser(user.id);
      if (result.error) {
        throw result.error;
      }
    }
  }

  return {
    deletedUserCount: deletableUsers.length,
    skippedPlatformAdminCount,
  };
}

async function cleanupFixtures(supabase, dryRun) {
  const businesses = await listCandidateBusinesses(supabase);
  const businessIds = businesses.map((business) => String(business.id));

  if (businessIds.length === 0) {
    return {
      dryRun,
      deletedBusinessCount: 0,
      deletedUserCount: 0,
      skippedProtectedBusinessCount: 0,
      skippedPlatformAdminCount: 0,
      prefixes: FIXTURE_PREFIXES,
    };
  }

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id")
    .in("business_id", businessIds);

  if (ordersError) {
    throw ordersError;
  }

  const orderIds = (orders || []).map((order) => order.id);
  const ownerIds = Array.from(
    new Set(
      businesses
        .map((business) => (business.owner_id ? String(business.owner_id) : null))
        .filter(Boolean)
    )
  );

  const deletions = [
    () => supabase.from("assistant_actions").delete().in("business_id", businessIds),
    () => supabase.from("assistant_messages").delete().in("business_id", businessIds),
    () => supabase.from("business_notifications").delete().in("business_id", businessIds),
    () => supabase.from("lead_events").delete().in("business_id", businessIds),
    () => supabase.from("legal_acceptances").delete().in("business_id", businessIds),
    () => supabase.from("messages").delete().in("business_id", businessIds),
    () => supabase.from("conversations").delete().in("business_id", businessIds),
    () => supabase.from("service_images").delete().in("business_id", businessIds),
    () => supabase.from("pricing_rules").delete().in("business_id", businessIds),
    () => supabase.from("slot_pricing").delete().in("business_id", businessIds),
    () => supabase.from("discount_codes").delete().in("business_id", businessIds),
    () => supabase.from("bookings").delete().in("business_id", businessIds),
    () => supabase.from("checkout_intents").delete().in("business_id", businessIds),
    () => supabase.from("rental_availability_blocks").delete().in("business_id", businessIds),
    () => supabase.from("rental_reservations").delete().in("business_id", businessIds),
    () => supabase.from("property_content").delete().in("business_id", businessIds),
    () => supabase.from("property_images").delete().in("business_id", businessIds),
    () => supabase.from("property").delete().in("business_id", businessIds),
    () => supabase.from("menu_item_option_groups").delete().in("business_id", businessIds),
    () => supabase.from("menu_options").delete().in("business_id", businessIds),
    () => supabase.from("menu_option_groups").delete().in("business_id", businessIds),
    () => supabase.from("menu_items").delete().in("business_id", businessIds),
    () => supabase.from("menu_categories").delete().in("business_id", businessIds),
    () => supabase.from("products").delete().in("business_id", businessIds),
    () => supabase.from("services").delete().in("business_id", businessIds),
    () => supabase.from("availability").delete().in("business_id", businessIds),
  ];

  for (const [index, deletion] of deletions.entries()) {
    await safeDelete(deletion, `cleanup-step-${index}`, dryRun);
  }

  if (orderIds.length > 0) {
    await safeDelete(
      () => supabase.from("order_items").delete().in("order_id", orderIds),
      "cleanup-order-items",
      dryRun
    );
  }

  await safeDelete(
    () => supabase.from("orders").delete().in("business_id", businessIds),
    "cleanup-orders",
    dryRun
  );
  await safeDelete(
    () => supabase.from("businesses").delete().in("id", businessIds),
    "cleanup-businesses",
    dryRun
  );

  const userCleanup = await cleanupFixtureUsers(supabase, ownerIds, dryRun);

  return {
    dryRun,
    deletedBusinessCount: businessIds.length,
    deletedUserCount: userCleanup.deletedUserCount,
    skippedProtectedBusinessCount: 0,
    skippedPlatformAdminCount: userCleanup.skippedPlatformAdminCount,
    prefixes: FIXTURE_PREFIXES,
    businesses: businesses.map((business) => ({
      id: String(business.id),
      slug: business.slug || null,
      name: business.name || null,
    })),
  };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  assertFixtureEnvironment({
    commandName: "cleanup fixtures",
    requireVerifyFlag: false,
    requireLocalBaseUrl: false,
    requireStripeKeys: false,
    logBanner: false,
  });

  console.warn("🚨 FIXTURE SEEDING ENABLED");
  console.warn(`Project: ${new URL(requireEnv("NEXT_PUBLIC_SUPABASE_URL")).hostname.split(".")[0] || "local"}`);
  console.warn(`Environment: ${process.env.NODE_ENV || "development"}`);

  const supabase = createSupabaseAdmin();
  const summary = await cleanupFixtures(supabase, dryRun);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("[cleanup-fixtures] failed:", error);
  process.exit(1);
});
