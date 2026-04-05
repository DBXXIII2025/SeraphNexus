import { createAdminClient } from "@/lib/supabase/server";
import type { PlanUsageSnapshot } from "@/lib/planEnforcement";

function safeCount(value: number | null) {
  return Number.isFinite(value) ? Number(value) : 0;
}

export async function loadBusinessUsageSnapshot(
  businessId: string
): Promise<PlanUsageSnapshot> {
  const supabaseAdmin = createAdminClient();

  const [
    servicesCount,
    productsCount,
    messageThreadsCount,
    bookingsCount,
    ordersCount,
    reservationsCount,
  ] = await Promise.all([
    supabaseAdmin
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId),
    supabaseAdmin
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId),
    supabaseAdmin
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId),
    supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId),
    supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId),
    supabaseAdmin
      .from("rental_reservations")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId),
  ]);

  return {
    max_services: safeCount(servicesCount.count),
    max_products: safeCount(productsCount.count),
    max_message_threads: safeCount(messageThreadsCount.count),
    max_transactions:
      safeCount(bookingsCount.count) +
      safeCount(ordersCount.count) +
      safeCount(reservationsCount.count),
  };
}

export async function loadOwnerBusinessCount(ownerUserId: string) {
  const supabaseAdmin = createAdminClient();
  const { count } = await supabaseAdmin
    .from("businesses")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerUserId);

  return safeCount(count);
}
