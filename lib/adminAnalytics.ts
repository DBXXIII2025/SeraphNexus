import { isOrderBusinessType } from "@/lib/businessModules";
import {
  resolveBookingGrossAmount,
  resolveOrderGrossAmount,
  resolveRentalGrossAmount,
} from "@/lib/paymentMath";
import { canAccessPlanFeature, getPlanDefinition, type PlanTier } from "@/lib/planConfig";

export const ANALYTICS_METRICS = [
  "revenue",
  "bookings",
  "orders",
  "completed",
  "cancelled",
] as const;

export const ANALYTICS_RANGE_PRESETS = [
  "7d",
  "30d",
  "90d",
  "this_month",
  "custom",
] as const;

export type AnalyticsMetric = (typeof ANALYTICS_METRICS)[number];
export type AnalyticsRangePreset = (typeof ANALYTICS_RANGE_PRESETS)[number];

export type AnalyticsBucket = {
  date: string;
  revenue: number;
  bookings: number;
  orders: number;
  completed: number;
  cancelled: number;
};

export type AnalyticsRange = {
  preset: AnalyticsRangePreset;
  startDate: string;
  endDate: string;
  totalDays: number;
};

export type AnalyticsSummary = Record<AnalyticsMetric, number>;

export type AnalyticsResponse = {
  business: {
    id: string;
    name: string;
    businessType: string | null;
    plan: PlanTier;
    planLabel: string;
    supportsAdvancedAnalytics: boolean;
  };
  range: AnalyticsRange;
  availableMetrics: AnalyticsMetric[];
  primaryMetric: Extract<AnalyticsMetric, "bookings" | "orders">;
  summary: AnalyticsSummary;
  buckets: AnalyticsBucket[];
};

type OrderAnalyticsRow = {
  id: string;
  status: string | null;
  payment_status: string | null;
  total_amount: number | null;
  created_at: string | null;
  hidden_from_ui: boolean | null;
  cancelled_at: string | null;
  completed_at: string | null;
  fulfilled_at: string | null;
};

type BookingAnalyticsRow = {
  id: string;
  status: string | null;
  payment_status: string | null;
  amount_total: number | null;
  total_amount: number | null;
  amount: number | null;
  created_at: string | null;
  date: string | null;
  hidden_from_ui: boolean | null;
  cancelled_at: string | null;
  completed_at: string | null;
  fulfilled_at: string | null;
};

type ReservationAnalyticsRow = {
  id: string;
  status: string | null;
  payment_status: string | null;
  amount_total: number | null;
  created_at: string | null;
  check_in_date: string | null;
  hidden_from_ui: boolean | null;
  cancelled_at: string | null;
  completed_at: string | null;
  fulfilled_at: string | null;
};

type AnalyticsSupabaseClient = {
  from: (table: string) => {
    select: (query: string) => {
      eq: (column: string, value: string) => {
        order: (
          column: string,
          options: { ascending: boolean }
        ) => Promise<{ data: unknown[] | null; error?: { message?: string } | null }>;
      };
    };
  };
};

function asUtcDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function toDateKey(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function diffDaysInclusive(startDate: string, endDate: string) {
  const start = asUtcDate(startDate).getTime();
  const end = asUtcDate(endDate).getTime();
  return Math.max(1, Math.floor((end - start) / 86_400_000) + 1);
}

function addDays(dateKey: string, days: number) {
  const date = asUtcDate(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildDateSeries(startDate: string, endDate: string) {
  const totalDays = diffDaysInclusive(startDate, endDate);
  return Array.from({ length: totalDays }, (_, index) => addDays(startDate, index));
}

function clampCustomRange(startDate: string, endDate: string) {
  if (startDate <= endDate) {
    return { startDate, endDate };
  }

  return {
    startDate: endDate,
    endDate: startDate,
  };
}

function isRangePreset(value: string | null | undefined): value is AnalyticsRangePreset {
  return ANALYTICS_RANGE_PRESETS.includes((value || "") as AnalyticsRangePreset);
}

export function resolveAnalyticsRange(args: {
  preset?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  now?: Date;
}) {
  const now = args.now || new Date();
  const today = now.toISOString().slice(0, 10);
  const preset = isRangePreset(args.preset) ? args.preset : "30d";

  if (preset === "custom") {
    const requestedStart = toDateKey(args.startDate);
    const requestedEnd = toDateKey(args.endDate);

    if (!requestedStart || !requestedEnd) {
      return {
        preset,
        startDate: addDays(today, -29),
        endDate: today,
        totalDays: 30,
      } satisfies AnalyticsRange;
    }

    const normalized = clampCustomRange(requestedStart, requestedEnd);
    return {
      preset,
      startDate: normalized.startDate,
      endDate: normalized.endDate,
      totalDays: diffDaysInclusive(normalized.startDate, normalized.endDate),
    } satisfies AnalyticsRange;
  }

  if (preset === "this_month") {
    const startDate = `${today.slice(0, 8)}01`;
    return {
      preset,
      startDate,
      endDate: today,
      totalDays: diffDaysInclusive(startDate, today),
    } satisfies AnalyticsRange;
  }

  const dayCount = preset === "7d" ? 7 : preset === "90d" ? 90 : 30;
  const startDate = addDays(today, -(dayCount - 1));

  return {
    preset,
    startDate,
    endDate: today,
    totalDays: dayCount,
  } satisfies AnalyticsRange;
}

function isCancelledStatus(status: string | null | undefined) {
  return status === "cancelled" || status === "canceled";
}

function isCompletedStatus(status: string | null | undefined) {
  return status === "completed" || status === "fulfilled" || status === "delivered";
}

function isOrderRevenueRow(row: OrderAnalyticsRow) {
  return (
    row.payment_status === "paid" ||
    row.status === "completed" ||
    row.status === "fulfilled" ||
    row.status === "delivered"
  );
}

function isBookingRevenueRow(row: BookingAnalyticsRow) {
  return (
    row.payment_status === "paid" ||
    row.status === "confirmed" ||
    row.status === "completed"
  );
}

function isReservationRevenueRow(row: ReservationAnalyticsRow) {
  return row.payment_status === "paid" || row.status === "confirmed" || row.status === "completed";
}

function createEmptyBucket(date: string): AnalyticsBucket {
  return {
    date,
    revenue: 0,
    bookings: 0,
    orders: 0,
    completed: 0,
    cancelled: 0,
  };
}

function createBucketMap(range: AnalyticsRange) {
  return new Map(
    buildDateSeries(range.startDate, range.endDate).map((date) => [date, createEmptyBucket(date)])
  );
}

function incrementMetric(
  bucketMap: Map<string, AnalyticsBucket>,
  date: string | null,
  metric: AnalyticsMetric,
  amount: number
) {
  if (!date || !bucketMap.has(date)) {
    return;
  }

  const bucket = bucketMap.get(date);
  if (!bucket) {
    return;
  }

  bucket[metric] += amount;
}

function summarizeBuckets(buckets: AnalyticsBucket[]): AnalyticsSummary {
  return buckets.reduce<AnalyticsSummary>(
    (summary, bucket) => {
      summary.revenue += bucket.revenue;
      summary.bookings += bucket.bookings;
      summary.orders += bucket.orders;
      summary.completed += bucket.completed;
      summary.cancelled += bucket.cancelled;
      return summary;
    },
    {
      revenue: 0,
      bookings: 0,
      orders: 0,
      completed: 0,
      cancelled: 0,
    }
  );
}

function toVisibleFlag(hiddenFromUi: boolean | null | undefined) {
  return hiddenFromUi !== true;
}

function processOrderRows(bucketMap: Map<string, AnalyticsBucket>, rows: OrderAnalyticsRow[]) {
  rows.forEach((row) => {
    const createdDate = toDateKey(row.created_at);
    const cancelledDate = toDateKey(row.cancelled_at) || createdDate;
    const completedDate =
      toDateKey(row.completed_at) || toDateKey(row.fulfilled_at) || createdDate;
    const visible = toVisibleFlag(row.hidden_from_ui);
    const cancelled = isCancelledStatus(row.status);
    const completed = isCompletedStatus(row.status);

    if (visible && !cancelled) {
      incrementMetric(bucketMap, createdDate, "orders", 1);
    }

    if (!cancelled && isOrderRevenueRow(row)) {
      incrementMetric(bucketMap, createdDate, "revenue", resolveOrderGrossAmount(row.total_amount));
    }

    if (!cancelled && completed) {
      incrementMetric(bucketMap, completedDate, "completed", 1);
    }

    if (cancelled) {
      incrementMetric(bucketMap, cancelledDate, "cancelled", 1);
    }
  });
}

function processBookingRows(bucketMap: Map<string, AnalyticsBucket>, rows: BookingAnalyticsRow[]) {
  rows.forEach((row) => {
    const createdDate = toDateKey(row.created_at) || toDateKey(row.date);
    const cancelledDate = toDateKey(row.cancelled_at) || createdDate;
    const completedDate =
      toDateKey(row.completed_at) || toDateKey(row.fulfilled_at) || createdDate;
    const visible = toVisibleFlag(row.hidden_from_ui);
    const cancelled = isCancelledStatus(row.status);
    const completed = isCompletedStatus(row.status);

    if (visible && !cancelled) {
      incrementMetric(bucketMap, createdDate, "bookings", 1);
    }

    if (!cancelled && isBookingRevenueRow(row)) {
      incrementMetric(bucketMap, createdDate, "revenue", resolveBookingGrossAmount(row));
    }

    if (!cancelled && completed) {
      incrementMetric(bucketMap, completedDate, "completed", 1);
    }

    if (cancelled) {
      incrementMetric(bucketMap, cancelledDate, "cancelled", 1);
    }
  });
}

function processReservationRows(
  bucketMap: Map<string, AnalyticsBucket>,
  rows: ReservationAnalyticsRow[]
) {
  rows.forEach((row) => {
    const createdDate = toDateKey(row.created_at) || toDateKey(row.check_in_date);
    const cancelledDate = toDateKey(row.cancelled_at) || createdDate;
    const completedDate =
      toDateKey(row.completed_at) || toDateKey(row.fulfilled_at) || createdDate;
    const visible = toVisibleFlag(row.hidden_from_ui);
    const cancelled = isCancelledStatus(row.status);
    const completed = isCompletedStatus(row.status);

    if (visible && !cancelled) {
      incrementMetric(bucketMap, createdDate, "bookings", 1);
    }

    if (!cancelled && isReservationRevenueRow(row)) {
      incrementMetric(
        bucketMap,
        createdDate,
        "revenue",
        resolveRentalGrossAmount(row.amount_total)
      );
    }

    if (!cancelled && completed) {
      incrementMetric(bucketMap, completedDate, "completed", 1);
    }

    if (cancelled) {
      incrementMetric(bucketMap, cancelledDate, "cancelled", 1);
    }
  });
}

export async function getBusinessAnalyticsPerformance(args: {
  supabase: AnalyticsSupabaseClient;
  business: {
    id: string;
    name?: string | null;
    business_type?: string | null;
    plan: PlanTier;
  };
  preset?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}) {
  const range = resolveAnalyticsRange({
    preset: args.preset,
    startDate: args.startDate,
    endDate: args.endDate,
  });
  const bucketMap = createBucketMap(range);
  const isOrderBusiness = isOrderBusinessType(args.business.business_type);
  const primaryMetric: Extract<AnalyticsMetric, "bookings" | "orders"> = isOrderBusiness
    ? "orders"
    : "bookings";

  if (isOrderBusiness) {
    const { data, error } = await args.supabase
      .from("orders")
      .select(
        "id,status,payment_status,total_amount,created_at,hidden_from_ui,cancelled_at,completed_at,fulfilled_at"
      )
      .eq("business_id", args.business.id)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(error.message || "Failed to load order analytics.");
    }

    processOrderRows(bucketMap, (data || []) as OrderAnalyticsRow[]);
  } else if (
    args.business.business_type === "rental" ||
    args.business.business_type === "property"
  ) {
    const { data, error } = await args.supabase
      .from("rental_reservations")
      .select(
        "id,status,payment_status,amount_total,created_at,check_in_date,hidden_from_ui,cancelled_at,completed_at,fulfilled_at"
      )
      .eq("business_id", args.business.id)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(error.message || "Failed to load reservation analytics.");
    }

    processReservationRows(bucketMap, (data || []) as ReservationAnalyticsRow[]);
  } else {
    const { data, error } = await args.supabase
      .from("bookings")
      .select(
        "id,status,payment_status,amount_total,total_amount,amount,created_at,date,hidden_from_ui,cancelled_at,completed_at,fulfilled_at"
      )
      .eq("business_id", args.business.id)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(error.message || "Failed to load booking analytics.");
    }

    processBookingRows(bucketMap, (data || []) as BookingAnalyticsRow[]);
  }

  const buckets = Array.from(bucketMap.values());

  return {
    business: {
      id: args.business.id,
      name: args.business.name || "Active business",
      businessType: args.business.business_type || null,
      plan: args.business.plan,
      planLabel: getPlanDefinition(args.business.plan).label,
      supportsAdvancedAnalytics: canAccessPlanFeature(args.business.plan, "advanced_analytics"),
    },
    range,
    availableMetrics: ["revenue", primaryMetric, "completed", "cancelled"],
    primaryMetric,
    summary: summarizeBuckets(buckets),
    buckets,
  } satisfies AnalyticsResponse;
}
