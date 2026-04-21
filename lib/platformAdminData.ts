import { PLAN_DEFINITIONS, normalizeBusinessPlan } from "@/lib/planConfig";
import { resolveAccessPlansForBusinesses } from "@/lib/accessGrants";
import {
  resolveBookingGrossAmount,
  resolveBookingPlatformFee,
  resolveOrderGrossAmount,
  resolveOrderPlatformFee,
  resolveRentalGrossAmount,
  resolveRentalPlatformFee,
} from "@/lib/paymentMath";
import { createAdminClient } from "@/lib/supabase/server";
import { getPlatformSupportConversationSummaries } from "@/lib/platformSupport";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";

type LooseRow = Record<string, unknown>;

export type PlatformMetric = {
  label: string;
  value: string;
  detail: string;
  tone: "neutral" | "success" | "alert";
};

export type PlatformBusinessRow = {
  id: string;
  name: string;
  ownerId: string | null;
  ownerEmail: string | null;
  businessType: string | null;
  plan: string;
  storedPlan: string;
  effectivePlan: string;
  isPublished: boolean;
  stripeReady: boolean;
  stripeConnected: boolean;
  legalAccepted: boolean;
  createdAt: string | null;
  lastActivityAt: string | null;
  grossRevenue: number;
  platformRevenue: number;
  transactions: number;
};

export type PlatformUserRow = {
  id: string;
  email: string | null;
  role: string | null;
  createdAt: string | null;
  ownedBusinessCount: number;
  linkedBusinessName: string | null;
  userType: "business_owner" | "customer_or_guest";
};

export type PlatformTransactionRow = {
  id: string;
  businessId: string;
  businessName: string;
  sourceType: "order" | "booking" | "reservation";
  createdAt: string | null;
  grossAmount: number;
  platformFee: number;
  paymentStatus: string | null;
  status: string | null;
};

type DatasetReadResult = {
  rows: LooseRow[];
  failed: boolean;
};

type AuthUserSummary = {
  id: string;
  email: string | null;
  createdAt: string | null;
};

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

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function getPlanMonthlyRevenue(plan: unknown) {
  const normalized = normalizeBusinessPlan(plan);

  if (normalized === "pro") {
    return 19;
  }

  if (normalized === "elite") {
    return 49;
  }

  return 0;
}

function createServiceRoleClient() {
  return createSupabaseClient(
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

async function getAuthUsersByIds(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, AuthUserSummary>();
  }

  const supabase = createServiceRoleClient();
  const rows = await Promise.all(
    userIds.map(async (userId) => {
      const { data, error } = await supabase.auth.admin.getUserById(userId);
      if (error) {
        console.error("[platform-admin] auth user read failed", {
          userId,
          message: error.message,
        });
        return null;
      }

      return {
        id: userId,
        email: data.user?.email || null,
        createdAt: data.user?.created_at || null,
      } satisfies AuthUserSummary;
    })
  );

  return new Map(rows.filter((row): row is AuthUserSummary => Boolean(row)).map((row) => [row.id, row]));
}

async function safeSelect(args: {
  name: string;
  table: string;
  query: string;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from(args.table).select(args.query);

  if (error) {
    console.error("[platform-admin] table read failed", {
      dataset: args.name,
      table: args.table,
      query: args.query,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return {
      rows: [] as LooseRow[],
      failed: true,
    } satisfies DatasetReadResult;
  }

  return {
    rows: ((data || []) as unknown as LooseRow[]),
    failed: false,
  } satisfies DatasetReadResult;
}

async function safeSupportThreads() {
  try {
    const rows = await getPlatformSupportConversationSummaries({});
    return {
      rows,
      failed: false,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown support thread failure";

    console.error("[platform-admin] table read failed", {
      dataset: "support_threads",
      table: "conversations/messages/businesses/profiles",
      query: "platform support thread summaries",
      message,
      details: null,
      hint: null,
      code: null,
    });

    return {
      rows: [],
      failed: true,
    };
  }
}

export async function getPlatformAdminData() {
  const datasetReads = await Promise.all([
    safeSelect({
      name: "businesses",
      table: "businesses",
      query:
        "id,name,owner_id,business_type,plan,is_published,created_at,stripe_account_id,stripe_onboarding_complete,stripe_charges_enabled",
    }),
    safeSelect({
      name: "legal_acceptances",
      table: "legal_acceptances",
      query: "id,user_id,business_id,document_key,accepted_at",
    }),
    safeSelect({
      name: "profiles",
      table: "profiles",
      query: "id,email,role,created_at",
    }),
    safeSelect({
      name: "orders",
      table: "orders",
      query: "*",
    }),
    safeSelect({
      name: "bookings",
      table: "bookings",
      query:
        "id,business_id,created_at,status,payment_status,amount_total,total_amount,platform_fee",
    }),
    safeSelect({
      name: "rental_reservations",
      table: "rental_reservations",
      query: "id,business_id,created_at,status,payment_status,amount_total,platform_fee",
    }),
    safeSelect({
      name: "lead_events",
      table: "lead_events",
      query: "id,business_id,created_at,event_type,status,last_contacted_at",
    }),
    safeSupportThreads(),
  ]);

  const [
    businessesRead,
    legalAcceptancesRead,
    profilesRead,
    ordersRead,
    bookingsRead,
    reservationsRead,
    leadEventsRead,
    supportThreadsRead,
  ] = datasetReads;

  const businesses = businessesRead.rows;
  const legalAcceptances = legalAcceptancesRead.rows;
  const profiles = profilesRead.rows;
  const orders = ordersRead.rows;
  const bookings = bookingsRead.rows;
  const reservations = reservationsRead.rows;
  const leadEvents = leadEventsRead.rows;
  const supportThreads = supportThreadsRead.rows;

  const failedDatasets = [
    businessesRead.failed ? "businesses" : null,
    legalAcceptancesRead.failed ? "legal_acceptances" : null,
    profilesRead.failed ? "profiles" : null,
    ordersRead.failed ? "orders" : null,
    bookingsRead.failed ? "bookings" : null,
    reservationsRead.failed ? "rental_reservations" : null,
    leadEventsRead.failed ? "lead_events" : null,
    supportThreadsRead.failed ? "support_threads" : null,
  ].filter((value): value is string => Boolean(value));

  if (failedDatasets.length > 0) {
    console.error("[platform-admin] partial data mode", {
      failedDatasets,
    });
  }

  const profileById = new Map(
    profiles.map((profile) => [String(profile.id), profile])
  );
  const legalByBusinessId = new Map<string, boolean>();
  legalAcceptances.forEach((record) => {
    const businessId = asString(record.business_id);
    const documentKey = asString(record.document_key);

    if (businessId && documentKey === "business_owner_platform_agreement") {
      legalByBusinessId.set(businessId, true);
    }
  });

  const transactionRows: PlatformTransactionRow[] = [];
  const businessRevenueMap = new Map<
    string,
    { grossRevenue: number; platformRevenue: number; transactions: number; lastActivityAt: string | null }
  >();

  function pushTransaction(row: PlatformTransactionRow) {
    transactionRows.push(row);
    const current = businessRevenueMap.get(row.businessId) || {
      grossRevenue: 0,
      platformRevenue: 0,
      transactions: 0,
      lastActivityAt: null,
    };
    current.grossRevenue += row.grossAmount;
    current.platformRevenue += row.platformFee;
    current.transactions += 1;
    if (toTimestamp(row.createdAt) > toTimestamp(current.lastActivityAt)) {
      current.lastActivityAt = row.createdAt;
    }
    businessRevenueMap.set(row.businessId, current);
  }

  orders.forEach((order) => {
    if (asString(order.payment_status) !== "paid") {
      return;
    }
    const businessId = asString(order.business_id);
    if (!businessId) {
      return;
    }
    const business = businesses.find((item) => String(item.id) === businessId);
    pushTransaction({
      id: String(order.id || ""),
      businessId,
      businessName: asString(business?.name) || "Business",
      sourceType: "order",
      createdAt: asString(order.created_at),
      grossAmount: resolveOrderGrossAmount(
        order.total_amount as string | number | null | undefined
      ),
      platformFee: resolveOrderPlatformFee(
        order.platform_fee as string | number | null | undefined
      ),
      paymentStatus: asString(order.payment_status),
      status: asString(order.status),
    });
  });

  bookings.forEach((booking) => {
    if (asString(booking.payment_status) !== "paid") {
      return;
    }
    const businessId = asString(booking.business_id);
    if (!businessId) {
      return;
    }
    const business = businesses.find((item) => String(item.id) === businessId);
    pushTransaction({
      id: String(booking.id || ""),
      businessId,
      businessName: asString(business?.name) || "Business",
      sourceType: "booking",
      createdAt: asString(booking.created_at),
      grossAmount: resolveBookingGrossAmount({
        amount_total: booking.amount_total as string | number | null | undefined,
        total_amount: booking.total_amount as string | number | null | undefined,
      }),
      platformFee: resolveBookingPlatformFee(
        booking.platform_fee as string | number | null | undefined
      ),
      paymentStatus: asString(booking.payment_status),
      status: asString(booking.status),
    });
  });

  reservations.forEach((reservation) => {
    if (asString(reservation.payment_status) !== "paid") {
      return;
    }
    const businessId = asString(reservation.business_id);
    if (!businessId) {
      return;
    }
    const business = businesses.find((item) => String(item.id) === businessId);
    pushTransaction({
      id: String(reservation.id || ""),
      businessId,
      businessName: asString(business?.name) || "Business",
      sourceType: "reservation",
      createdAt: asString(reservation.created_at),
      grossAmount: resolveRentalGrossAmount(
        reservation.amount_total as string | number | null | undefined
      ),
      platformFee: resolveRentalPlatformFee(
        reservation.platform_fee as string | number | null | undefined
      ),
      paymentStatus: asString(reservation.payment_status),
      status: asString(reservation.status),
    });
  });

  const recentLeadByBusinessId = new Map<string, string | null>();
  leadEvents.forEach((event) => {
    const businessId = asString(event.business_id);
    if (!businessId) {
      return;
    }
    const createdAt = asString(event.created_at);
    const current = recentLeadByBusinessId.get(businessId);
    if (toTimestamp(createdAt) > toTimestamp(current)) {
      recentLeadByBusinessId.set(businessId, createdAt);
    }
  });

  const resolvedBusinesses = await resolveAccessPlansForBusinesses({
    businesses: businesses.map((business) => ({
      id: String(business.id || ""),
      owner_id: asString(business.owner_id),
      plan: business.plan,
    })),
  });
  const resolvedBusinessPlanById = new Map(
    resolvedBusinesses.map((business) => [business.id, normalizeBusinessPlan(business.plan)])
  );

  const businessRows: PlatformBusinessRow[] = businesses.map((business) => {
    const businessId = String(business.id);
    const ownerId = asString(business.owner_id);
    const ownerProfile = ownerId ? profileById.get(ownerId) || null : null;
    const revenue = businessRevenueMap.get(businessId) || {
      grossRevenue: 0,
      platformRevenue: 0,
      transactions: 0,
      lastActivityAt: null,
    };
    const lastLead = recentLeadByBusinessId.get(businessId) || null;
    const lastActivityAt =
      toTimestamp(revenue.lastActivityAt) >= toTimestamp(lastLead)
        ? revenue.lastActivityAt
        : lastLead;

    const storedPlan = normalizeBusinessPlan(business.plan);
    const effectivePlan = resolvedBusinessPlanById.get(businessId) || storedPlan;

    return {
      id: businessId,
      name: asString(business.name) || "Untitled business",
      ownerId,
      ownerEmail: asString(ownerProfile?.email) || null,
      businessType: asString(business.business_type),
      plan: effectivePlan,
      storedPlan,
      effectivePlan,
      isPublished: asBoolean(business.is_published),
      stripeReady:
        asBoolean(business.stripe_onboarding_complete) &&
        asBoolean(business.stripe_charges_enabled),
      stripeConnected: Boolean(asString(business.stripe_account_id)),
      legalAccepted: legalByBusinessId.get(businessId) === true,
      createdAt: asString(business.created_at),
      lastActivityAt,
      grossRevenue: revenue.grossRevenue,
      platformRevenue: revenue.platformRevenue,
      transactions: revenue.transactions,
    };
  });

  const ownedBusinessCountByUserId = new Map<string, number>();
  const firstBusinessNameByUserId = new Map<string, string | null>();
  businessRows.forEach((business) => {
    if (!business.ownerId) {
      return;
    }

    ownedBusinessCountByUserId.set(
      business.ownerId,
      (ownedBusinessCountByUserId.get(business.ownerId) || 0) + 1
    );

    if (!firstBusinessNameByUserId.has(business.ownerId)) {
      firstBusinessNameByUserId.set(business.ownerId, business.name);
    }
  });

  const managedAccountIds = [
    ...new Set(
      [
        ...businessRows.map((business) => business.ownerId).filter((value): value is string => Boolean(value)),
        ...profiles
          .filter((profile) => asString(profile.role) === "owner")
          .map((profile) => asString(profile.id))
          .filter((value): value is string => Boolean(value)),
      ].filter(Boolean)
    ),
  ];
  const authUserById = await getAuthUsersByIds(managedAccountIds);

  // Platform account surfaces should reflect business/platform operator accounts,
  // not every profile row, so customer/guest noise does not inflate production counts.
  const userRows: PlatformUserRow[] = managedAccountIds.map((userId) => {
    const profile = profileById.get(userId) || null;
    const authUser = authUserById.get(userId) || null;
    const ownedBusinessCount = ownedBusinessCountByUserId.get(userId) || 0;

    return {
      id: userId,
      email: authUser?.email || asString(profile?.email) || null,
      role: asString(profile?.role),
      createdAt: authUser?.createdAt || asString(profile?.created_at),
      ownedBusinessCount,
      linkedBusinessName: firstBusinessNameByUserId.get(userId) || null,
      userType: ownedBusinessCount > 0 ? "business_owner" : "customer_or_guest",
    };
  });

  const totalMRR = businessRows.reduce(
    (sum, business) => sum + getPlanMonthlyRevenue(business.storedPlan),
    0
  );
  const unreadSupportMessages = supportThreads.reduce(
    (sum, thread) => sum + (typeof thread.unreadForPlatform === "number" ? thread.unreadForPlatform : 0),
    0
  );
  const activeBusinesses = businessRows.filter(
    (business) =>
      business.isPublished ||
      business.transactions > 0 ||
      toTimestamp(business.lastActivityAt) > 0
  ).length;
  const payingBusinesses = businessRows.filter(
    (business) => getPlanMonthlyRevenue(business.storedPlan) > 0
  ).length;

  const planDistribution = Object.keys(PLAN_DEFINITIONS).map((tier) => ({
    label: PLAN_DEFINITIONS[tier as keyof typeof PLAN_DEFINITIONS].label,
    count: businessRows.filter((business) => business.storedPlan === tier).length,
  }));

  const recentBusinessSignups = [...businessRows]
    .sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt))
    .slice(0, 8);
  const recentUsers = [...userRows]
    .sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt))
    .slice(0, 10);
  const topPerformingBusinesses = [...businessRows]
    .sort((a, b) => b.grossRevenue - a.grossRevenue || b.transactions - a.transactions)
    .slice(0, 8);
  const businessesNeedingAttention = businessRows.filter(
    (business) => !business.legalAccepted || !business.stripeReady || !business.isPublished
  );
  const inactiveBusinesses = businessRows.filter(
    (business) => !business.isPublished && business.transactions === 0 && !business.lastActivityAt
  );
  const recentTransactions = [...transactionRows]
    .sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt))
    .slice(0, 20);

  const metrics: PlatformMetric[] = [
    {
      label: "Total businesses",
      value: String(businessRows.length),
      detail: "All platform businesses across every tenant.",
      tone: "neutral",
    },
    {
      label: "Active businesses",
      value: String(activeBusinesses),
      detail: "Published businesses or businesses with recorded recent activity.",
      tone: "success",
    },
    {
      label: "Managed accounts",
      value: String(userRows.length),
      detail: "Platform admin plus owners of the remaining live businesses.",
      tone: "neutral",
    },
    {
      label: "Paying businesses",
      value: String(payingBusinesses),
      detail: "Businesses on paid plans derived from current plan assignments.",
      tone: "success",
    },
    {
      label: "Projected MRR",
      value: new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(totalMRR),
      detail: "Derived from current business plan distribution.",
      tone: "success",
    },
    {
      label: "Unread support",
      value: String(unreadSupportMessages),
      detail: supportThreadsRead.failed
        ? "Support thread summaries are partially unavailable."
        : "Unread business-owner support messages awaiting platform response.",
      tone: unreadSupportMessages > 0 || supportThreadsRead.failed ? "alert" : "neutral",
    },
  ];

  return {
    metrics,
    businessRows,
    userRows,
    recentTransactions,
    topPerformingBusinesses,
    recentBusinessSignups,
    recentUsers,
    businessesNeedingAttention,
    inactiveBusinesses,
    supportThreads,
    planDistribution,
    totalMRR,
    unreadSupportMessages,
    transactionGrossRevenue: transactionRows.reduce((sum, row) => sum + row.grossAmount, 0),
    transactionPlatformRevenue: transactionRows.reduce((sum, row) => sum + row.platformFee, 0),
    failedDatasets,
  };
}
