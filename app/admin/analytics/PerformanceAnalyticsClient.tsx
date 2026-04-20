"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";
import type {
  AnalyticsMetric,
  AnalyticsRangePreset,
  AnalyticsResponse,
} from "@/lib/adminAnalytics";

type Props = {
  businessId: string;
  businessName: string;
  planLabel: string;
  supportsAdvancedAnalytics: boolean;
  defaultMetric: AnalyticsMetric;
  defaultRange: AnalyticsRangePreset;
};

type LoadState =
  | { status: "loading"; data: AnalyticsResponse | null; error: string | null }
  | { status: "ready"; data: AnalyticsResponse; error: null }
  | { status: "empty"; data: AnalyticsResponse; error: null }
  | { status: "error"; data: AnalyticsResponse | null; error: string };

const RANGE_OPTIONS: Array<{ value: AnalyticsRangePreset; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "this_month", label: "This month" },
  { value: "custom", label: "Custom" },
];

const METRIC_LABELS: Record<AnalyticsMetric, string> = {
  revenue: "Revenue",
  bookings: "Bookings",
  orders: "Orders",
  completed: "Completed",
  cancelled: "Cancelled",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatMetricValue(metric: AnalyticsMetric, value: number) {
  if (metric === "revenue") {
    return formatCurrency(value);
  }

  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function formatAxisDate(dateKey: string) {
  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dateKey;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(parsed);
}

function buildRangeLabel(data: AnalyticsResponse | null) {
  if (!data) {
    return "";
  }

  return `${formatAxisDate(data.range.startDate)} - ${formatAxisDate(data.range.endDate)}`;
}

function EmptyState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-raised)] px-6 py-12 text-center">
      <p className="text-base font-medium text-[var(--text-strong)]">{title}</p>
      <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">{detail}</p>
    </div>
  );
}

export default function PerformanceAnalyticsClient({
  businessId,
  businessName,
  planLabel,
  supportsAdvancedAnalytics,
  defaultMetric,
  defaultRange,
}: Props) {
  const [selectedMetric, setSelectedMetric] = useState<AnalyticsMetric>(defaultMetric);
  const [rangePreset, setRangePreset] = useState<AnalyticsRangePreset>(defaultRange);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  const [state, setState] = useState<LoadState>({
    status: "loading",
    data: null,
    error: null,
  });

  const deferredCustomStartDate = useDeferredValue(customStartDate);
  const deferredCustomEndDate = useDeferredValue(customEndDate);
  const rangeLabel = buildRangeLabel(state.data);

  const loadAnalytics = useEffectEvent(async () => {
    const params = new URLSearchParams({
      businessId,
      range: rangePreset,
    });

    if (rangePreset === "custom") {
      if (!deferredCustomStartDate || !deferredCustomEndDate) {
        return;
      }

      params.set("startDate", deferredCustomStartDate);
      params.set("endDate", deferredCustomEndDate);
    }

    setState((current) => ({
      status: "loading",
      data: current.data,
      error: null,
    }));

    try {
      const response = await fetch(`/api/admin/analytics/performance?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as AnalyticsResponse | { error?: string };

      if (!response.ok || !("buckets" in payload)) {
        throw new Error(payload.error || "Failed to load analytics.");
      }

      startTransition(() => {
        const hasVisibleData = payload.buckets.some(
          (bucket) =>
            bucket.revenue > 0 ||
            bucket.bookings > 0 ||
            bucket.orders > 0 ||
            bucket.completed > 0 ||
            bucket.cancelled > 0
        );

        setState({
          status: hasVisibleData ? "ready" : "empty",
          data: payload,
          error: null,
        });

        if (!payload.availableMetrics.includes(selectedMetric)) {
          setSelectedMetric(payload.primaryMetric);
        }
      });
    } catch (error) {
      setState((current) => ({
        status: "error",
        data: current.data,
        error: error instanceof Error ? error.message : "Failed to load analytics.",
      }));
    }
  });

  useEffect(() => {
    loadAnalytics();
  }, [businessId, rangePreset, deferredCustomStartDate, deferredCustomEndDate, reloadTick]);

  const chartData = useMemo(() => {
    const buckets = state.data?.buckets || [];
    return buckets.map((bucket) => ({
      ...bucket,
      label: formatAxisDate(bucket.date),
      selectedValue: bucket[selectedMetric],
    }));
  }, [selectedMetric, state.data]);

  const selectedMetricTotal = state.data?.summary[selectedMetric] || 0;
  const selectedMetricPeak = chartData.reduce(
    (peak, bucket) => (bucket.selectedValue > peak ? bucket.selectedValue : peak),
    0
  );

  return (
    <div className="space-y-6">
      <section className="surface-card p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="section-header-copy">
            <p className="section-kicker">Performance Graph</p>
            <h2 className="section-title">Live daily analytics for {businessName}</h2>
            <p className="section-description">
              Daily buckets auto-calculate from the active business data source and stay aligned to
              the current workspace context.
            </p>
          </div>

          <div className="min-w-full space-y-4 xl:min-w-[340px]">
            <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-raised)] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">
                Date range
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {RANGE_OPTIONS.map((option) => {
                  const isActive = rangePreset === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setRangePreset(option.value)}
                      className={`rounded-full border px-3 py-2 text-sm transition ${
                        isActive
                          ? "border-[var(--accent-soft)] bg-[var(--accent-muted)] text-[var(--text-strong)]"
                          : "border-[var(--border-soft)] bg-[var(--surface-raised)] text-[var(--text-soft)] hover:border-[var(--accent-soft)]"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              {rangePreset === "custom" ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm text-[var(--text-soft)]">
                    <span className="form-label">Start date</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(event) => setCustomStartDate(event.target.value)}
                      className="input-field"
                    />
                  </label>
                  <label className="text-sm text-[var(--text-soft)]">
                    <span className="form-label">End date</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(event) => setCustomEndDate(event.target.value)}
                      className="input-field"
                    />
                  </label>
                </div>
              ) : null}
            </div>

            <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-raised)] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">
                Metric
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(Object.keys(METRIC_LABELS) as AnalyticsMetric[]).map((metric) => {
                  const isSupported = state.data?.availableMetrics.includes(metric) ?? true;
                  const isActive = selectedMetric === metric;
                  return (
                    <button
                      key={metric}
                      type="button"
                      disabled={!isSupported}
                      onClick={() => setSelectedMetric(metric)}
                      className={`rounded-full border px-3 py-2 text-sm transition ${
                        isActive
                          ? "border-[var(--accent-soft)] bg-[var(--destructive-bg)] text-[var(--text-strong)]"
                          : isSupported
                            ? "border-[var(--border-soft)] bg-[var(--surface-raised)] text-[var(--text-soft)] hover:border-[var(--accent-soft)]"
                            : "cursor-not-allowed border-[var(--border-soft)] bg-[var(--surface-raised)] text-[var(--text-muted)] opacity-55"
                      }`}
                    >
                      {METRIC_LABELS[metric]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card p-5">
          <p className="section-kicker">{METRIC_LABELS[selectedMetric]}</p>
          <p className="mt-4 text-[1.95rem] font-semibold text-[var(--text-strong)]">
            {formatMetricValue(selectedMetric, selectedMetricTotal)}
          </p>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            {rangeLabel || "Current range"} total
          </p>
        </div>
        <div className="metric-card p-5">
          <p className="section-kicker">Peak day</p>
          <p className="mt-4 text-[1.95rem] font-semibold text-[var(--accent-soft)]">
            {formatMetricValue(selectedMetric, selectedMetricPeak)}
          </p>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            Highest single-day value in the selected window
          </p>
        </div>
        <div className="metric-card p-5">
          <p className="section-kicker">Plan</p>
          <p className="mt-4 text-[1.95rem] font-semibold text-[var(--text-strong)]">
            {planLabel}
          </p>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            Core analytics are enabled for this business
          </p>
        </div>
        <div className="metric-card p-5">
          <p className="section-kicker">Advanced</p>
          <p className="mt-4 text-[1.95rem] font-semibold text-[var(--accent-soft)]">
            {supportsAdvancedAnalytics ? "Elite ready" : "Pro core"}
          </p>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            {supportsAdvancedAnalytics
              ? "Expanded breakdowns can layer onto this graph next."
              : "Upgrade to Elite later for richer advanced analytics."}
          </p>
        </div>
      </section>

      <section className="surface-card p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-kicker">Daily trend</p>
            <h3 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
              {METRIC_LABELS[selectedMetric]} over time
            </h3>
          </div>
          <p className="text-sm text-[var(--text-soft)]">
            {rangeLabel || "Selected range"} {state.status === "loading" ? "| refreshing" : ""}
          </p>
        </div>

        <div className="mt-6 min-h-[360px]">
          {state.status === "loading" && !state.data ? (
            <div className="h-[360px] animate-pulse rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-raised)]" />
          ) : state.status === "error" ? (
            <EmptyState
              title="Analytics could not be loaded"
              detail={state.error || "A temporary error interrupted the analytics request."}
            />
          ) : state.status === "empty" ? (
            <EmptyState
              title="No chartable activity in this range"
              detail="Try a longer date window or wait for new bookings, orders, reservations, completions, or cancellations to land."
            />
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="analyticsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.36} />
                    <stop offset="60%" stopColor="#C1121F" stopOpacity={0.14} />
                    <stop offset="95%" stopColor="#171313" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(58,47,47,0.7)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  stroke="#8f8782"
                  tick={{ fill: "#8f8782", fontSize: 12 }}
                  minTickGap={24}
                />
                <YAxis
                  stroke="#8f8782"
                  tick={{ fill: "#8f8782", fontSize: 12 }}
                  tickFormatter={(value: number) =>
                    selectedMetric === "revenue"
                      ? `$${Math.round(value)}`
                      : new Intl.NumberFormat("en-US").format(value)
                  }
                />
                <Tooltip
                  formatter={(value: number) => formatMetricValue(selectedMetric, Number(value))}
                  labelFormatter={(label) => `Day: ${String(label)}`}
                  contentStyle={{
                    background: "#171313",
                    border: "1px solid #3A2F2F",
                    borderRadius: "16px",
                    color: "#F5F5F5",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="selectedValue"
                  stroke="#D4AF37"
                  strokeWidth={3}
                  fill="url(#analyticsFill)"
                  activeDot={{ r: 5, fill: "#E8CC6A" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {state.status === "loading" && state.data ? (
          <p className="mt-4 text-sm text-[var(--text-muted)]">
            Updating the graph with the latest daily buckets.
          </p>
        ) : null}

        {state.data?.warnings && state.data.warnings.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-muted)] px-4 py-3 text-sm text-[var(--accent-soft)]">
            {state.data.warnings[0]}
          </div>
        ) : null}

        {state.status === "error" ? (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setReloadTick((value) => value + 1)}
              className="btn-secondary px-4 py-2 text-sm font-medium"
            >
              Retry analytics load
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
