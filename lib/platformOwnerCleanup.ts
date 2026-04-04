import { createAdminClient } from "@/lib/supabase/server";

type LooseRow = Record<string, unknown>;

export type BusinessDependencyCount = {
  key: string;
  label: string;
  count: number;
};

export type PlatformOwnerBusinessAudit = {
  id: string;
  name: string;
  slug: string | null;
  businessType: string | null;
  isPublished: boolean;
  createdAt: string | null;
  isLikelyTestBusiness: boolean;
  totalDependencies: number;
  dependencyCounts: BusinessDependencyCount[];
  auditFailed: boolean;
  canDeleteNow: boolean;
};

export type PlatformIncomeAudit = {
  subscriptionPlanBacked: boolean;
  hasSubscriptionLedger: boolean;
  hasStoredOrderPlatformFees: boolean;
  hasStoredBookingPlatformFees: boolean;
  hasStoredReservationPlatformFees: boolean;
  notes: string[];
};

export const PLATFORM_OWNER_CLEANUP_SEQUENCE = [
  "order_items (via orders)",
  "messages",
  "conversations",
  "checkout_intents",
  "bookings",
  "orders",
  "services",
  "availability",
  "property_images",
  "property_content",
  "rental_availability_blocks",
  "rental_reservations",
  "products",
  "pricing_rules",
  "lead_events",
  "legal_acceptances",
  "property",
  "businesses",
] as const;

function asString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asBoolean(value: unknown) {
  return value === true;
}

function logCleanupReadFailure(table: string, step: string, error: unknown) {
  const normalized = error as {
    message?: string;
    details?: string | null;
    hint?: string | null;
    code?: string | null;
  };

  console.error("[platform-owner-cleanup] dependency read failed", {
    table,
    step,
    message: normalized?.message || "Unknown error",
    details: normalized?.details || null,
    hint: normalized?.hint || null,
    code: normalized?.code || null,
  });
}

function logCleanupDeleteFailure(table: string, step: string, error: unknown) {
  const normalized = error as {
    message?: string;
    details?: string | null;
    hint?: string | null;
    code?: string | null;
  };

  console.error("[platform-owner-cleanup] delete failed", {
    table,
    step,
    message: normalized?.message || "Unknown error",
    details: normalized?.details || null,
    hint: normalized?.hint || null,
    code: normalized?.code || null,
  });
}

function isLikelyTestBusinessName(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return /(test|demo|sample|sandbox|qa|dev|dummy|temp|staging|playground)/i.test(
    value
  );
}

async function countBusinessScopedRows(table: string, businessId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("business_id", businessId);

  if (error) {
    logCleanupReadFailure(table, "count_business_rows", error);
    return { count: 0, failed: true };
  }

  return {
    count: (data || []).length,
    failed: false,
  };
}

async function getOrderDependencyCount(businessId: string) {
  const supabase = createAdminClient();
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id")
    .eq("business_id", businessId);

  if (ordersError) {
    logCleanupReadFailure("orders", "count_orders", ordersError);
    return {
      orderCount: 0,
      orderItemCount: 0,
      failed: true,
    };
  }

  const orderIds = ((orders || []) as LooseRow[])
    .map((row) => asString(row.id))
    .filter((value): value is string => Boolean(value));

  if (orderIds.length === 0) {
    return {
      orderCount: 0,
      orderItemCount: 0,
      failed: false,
    };
  }

  const { data: orderItems, error: orderItemsError } = await supabase
    .from("order_items")
    .select("id")
    .in("order_id", orderIds);

  if (orderItemsError) {
    logCleanupReadFailure("order_items", "count_order_items", orderItemsError);
    return {
      orderCount: orderIds.length,
      orderItemCount: 0,
      failed: true,
    };
  }

  return {
    orderCount: orderIds.length,
    orderItemCount: (orderItems || []).length,
    failed: false,
  };
}

export async function getPlatformOwnerBusinessAudits(ownerUserId: string) {
  const supabase = createAdminClient();
  const { data: businesses, error } = await supabase
    .from("businesses")
    .select("id,name,slug,business_type,is_published,created_at")
    .eq("owner_id", ownerUserId)
    .order("created_at", { ascending: false });

  if (error) {
    logCleanupReadFailure("businesses", "load_owned_businesses", error);
    return [] as PlatformOwnerBusinessAudit[];
  }

  const rows = ((businesses || []) as LooseRow[]).map(async (business) => {
    const businessId = String(business.id || "");
    const [
      bookings,
      services,
      availability,
      conversations,
      messages,
      checkoutIntents,
      legalAcceptances,
      leadEvents,
      reservations,
      reservationBlocks,
      properties,
      propertyImages,
      propertyContent,
      products,
      pricingRules,
      orderDependencies,
    ] = await Promise.all([
      countBusinessScopedRows("bookings", businessId),
      countBusinessScopedRows("services", businessId),
      countBusinessScopedRows("availability", businessId),
      countBusinessScopedRows("conversations", businessId),
      countBusinessScopedRows("messages", businessId),
      countBusinessScopedRows("checkout_intents", businessId),
      countBusinessScopedRows("legal_acceptances", businessId),
      countBusinessScopedRows("lead_events", businessId),
      countBusinessScopedRows("rental_reservations", businessId),
      countBusinessScopedRows("rental_availability_blocks", businessId),
      countBusinessScopedRows("property", businessId),
      countBusinessScopedRows("property_images", businessId),
      countBusinessScopedRows("property_content", businessId),
      countBusinessScopedRows("products", businessId),
      countBusinessScopedRows("pricing_rules", businessId),
      getOrderDependencyCount(businessId),
    ]);

    const dependencyCounts: BusinessDependencyCount[] = [
      { key: "bookings", label: "Bookings", count: bookings.count },
      { key: "services", label: "Services", count: services.count },
      { key: "availability", label: "Availability", count: availability.count },
      { key: "conversations", label: "Conversations", count: conversations.count },
      { key: "messages", label: "Messages", count: messages.count },
      { key: "checkout_intents", label: "Checkout intents", count: checkoutIntents.count },
      { key: "orders", label: "Orders", count: orderDependencies.orderCount },
      { key: "order_items", label: "Order items", count: orderDependencies.orderItemCount },
      { key: "properties", label: "Properties", count: properties.count },
      { key: "property_images", label: "Property images", count: propertyImages.count },
      { key: "property_content", label: "Property content", count: propertyContent.count },
      { key: "rental_reservations", label: "Rental reservations", count: reservations.count },
      { key: "rental_availability_blocks", label: "Blocked dates", count: reservationBlocks.count },
      { key: "products", label: "Products", count: products.count },
      { key: "pricing_rules", label: "Pricing rules", count: pricingRules.count },
      { key: "lead_events", label: "Lead events", count: leadEvents.count },
      { key: "legal_acceptances", label: "Legal acceptances", count: legalAcceptances.count },
    ].filter((item) => item.count > 0);

    const auditFailed =
      bookings.failed ||
      services.failed ||
      availability.failed ||
      conversations.failed ||
      messages.failed ||
      checkoutIntents.failed ||
      legalAcceptances.failed ||
      leadEvents.failed ||
      reservations.failed ||
      reservationBlocks.failed ||
      properties.failed ||
      propertyImages.failed ||
      propertyContent.failed ||
      products.failed ||
      pricingRules.failed ||
      orderDependencies.failed;

    const totalDependencies = dependencyCounts.reduce(
      (sum, item) => sum + item.count,
      0
    );
    const name = asString(business.name) || "Untitled business";
    const slug = asString(business.slug);
    const isLikelyTestBusiness =
      isLikelyTestBusinessName(name) || isLikelyTestBusinessName(slug);

    return {
      id: businessId,
      name,
      slug,
      businessType: asString(business.business_type),
      isPublished: asBoolean(business.is_published),
      createdAt: asString(business.created_at),
      isLikelyTestBusiness,
      totalDependencies,
      dependencyCounts,
      auditFailed,
      canDeleteNow: isLikelyTestBusiness && !auditFailed && totalDependencies === 0,
    } satisfies PlatformOwnerBusinessAudit;
  });

  return Promise.all(rows);
}

async function deleteBusinessScopedRows(table: string, businessId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from(table).delete().eq("business_id", businessId);

  if (error) {
    logCleanupDeleteFailure(table, "delete_business_rows", error);
    throw new Error(error.message || `Failed deleting ${table}`);
  }
}

export async function deletePlatformOwnerTestBusiness(args: {
  businessId: string;
  ownerUserId: string;
}) {
  const supabase = createAdminClient();
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id,name,slug,owner_id")
    .eq("id", args.businessId)
    .eq("owner_id", args.ownerUserId)
    .maybeSingle();

  if (businessError || !business?.id) {
    logCleanupDeleteFailure("businesses", "load_target_business", businessError);
    throw new Error("Business not found for this owner");
  }

  const businessName = asString(business.name);
  const businessSlug = asString(business.slug);
  const isLikelyTestBusiness =
    isLikelyTestBusinessName(businessName) || isLikelyTestBusinessName(businessSlug);

  if (!isLikelyTestBusiness) {
    throw new Error(
      "Only test or demo businesses are eligible for platform-owner cleanup."
    );
  }

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id")
    .eq("business_id", args.businessId);

  if (ordersError) {
    logCleanupDeleteFailure("orders", "load_orders_for_cleanup", ordersError);
    throw new Error(ordersError.message || "Failed to load order dependencies");
  }

  const orderIds = ((orders || []) as LooseRow[])
    .map((row) => asString(row.id))
    .filter((value): value is string => Boolean(value));

  if (orderIds.length > 0) {
    const { error: orderItemsError } = await supabase
      .from("order_items")
      .delete()
      .in("order_id", orderIds);

    if (orderItemsError) {
      logCleanupDeleteFailure("order_items", "delete_order_items", orderItemsError);
      throw new Error(orderItemsError.message || "Failed to delete order items");
    }
  }

  await deleteBusinessScopedRows("messages", args.businessId);
  await deleteBusinessScopedRows("conversations", args.businessId);
  await deleteBusinessScopedRows("checkout_intents", args.businessId);
  await deleteBusinessScopedRows("bookings", args.businessId);
  await deleteBusinessScopedRows("orders", args.businessId);
  await deleteBusinessScopedRows("services", args.businessId);
  await deleteBusinessScopedRows("availability", args.businessId);
  await deleteBusinessScopedRows("property_images", args.businessId);
  await deleteBusinessScopedRows("property_content", args.businessId);
  await deleteBusinessScopedRows("rental_availability_blocks", args.businessId);
  await deleteBusinessScopedRows("rental_reservations", args.businessId);
  await deleteBusinessScopedRows("products", args.businessId);
  await deleteBusinessScopedRows("pricing_rules", args.businessId);
  await deleteBusinessScopedRows("lead_events", args.businessId);
  await deleteBusinessScopedRows("legal_acceptances", args.businessId);
  await deleteBusinessScopedRows("property", args.businessId);

  const { error: deleteBusinessError } = await supabase
    .from("businesses")
    .delete()
    .eq("id", args.businessId)
    .eq("owner_id", args.ownerUserId);

  if (deleteBusinessError) {
    logCleanupDeleteFailure("businesses", "delete_business", deleteBusinessError);
    throw new Error(
      deleteBusinessError.message ||
        "Business deletion is still blocked by a remaining dependency."
    );
  }
}

export function getPlatformIncomeAudit(): PlatformIncomeAudit {
  return {
    subscriptionPlanBacked: true,
    hasSubscriptionLedger: false,
    hasStoredOrderPlatformFees: false,
    hasStoredBookingPlatformFees: true,
    hasStoredReservationPlatformFees: true,
    notes: [
      "Recurring SaaS revenue is currently derived from business plan assignments, not from a dedicated subscription ledger table.",
      "Stripe subscription checkout updates the businesses.plan field, but the repository does not currently persist subscription invoices or payout rows in Supabase.",
      "Order records do not store platform_fee, so order-origin platform income cannot be derived exactly from the current schema.",
      "Bookings and rental_reservations do store platform_fee, so those platform-fee totals are the only directly stored fee revenue signals available now.",
    ],
  };
}
