"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { resolveBookingGrossAmount } from "@/lib/paymentMath";
import type { Database } from "@/types/database";

type BookingLike = Database["public"]["Tables"]["bookings"]["Row"] &
  Partial<Database["public"]["Tables"]["rental_reservations"]["Row"]>;

type Props = {
  bookings: BookingLike[];
  leads: Database["public"]["Tables"]["leads"]["Row"][];
};

function groupByDate(
  data: Array<Record<string, string | number | null>>,
  dateField: string
) {
  const map: Record<string, number> = {};

  data.forEach((item) => {
    if (!item[dateField]) {
      return;
    }

    const date = String(item[dateField]).slice(0, 10);
    map[date] = (map[date] || 0) + 1;
  });

  return Object.entries(map)
    .map(([date, count]) => ({
      date,
      count,
    }))
    .sort((a, b) => (a.date > b.date ? 1 : -1))
    .slice(-10);
}

function OverviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{value}</p>
    </div>
  );
}

export default function DashboardCharts({ bookings, leads }: Props) {
  const safeBookings = Array.isArray(bookings) ? bookings : [];
  const safeLeads = Array.isArray(leads) ? leads : [];

  const bookingData = groupByDate(
    safeBookings.map((booking) => ({
      ...booking,
      chart_date: booking.date || booking.check_in_date || null,
    })),
    "chart_date"
  );
  const leadData = groupByDate(safeLeads, "created_at");

  const revenue = safeBookings.reduce(
    (sum, booking) =>
      sum +
      resolveBookingGrossAmount({
        amount_total: booking.amount_total,
        total_amount: booking.total_amount,
      }),
    0
  );
  const totalBookings = safeBookings.length;
  const totalLeads = safeLeads.length;
  const conversionRate = totalLeads > 0 ? ((totalBookings / totalLeads) * 100).toFixed(1) : "0";
  const roi = totalLeads > 0 ? (revenue / totalLeads).toFixed(2) : "0";

  const aiInsight =
    conversionRate === "0"
      ? "No conversions yet. Improve response speed and tighten call-to-action placement."
      : Number(conversionRate) < 20
        ? "Conversion is low. Review lead quality and first-touch follow-up execution."
        : Number(conversionRate) < 50
          ? "Performance is stable. Continue optimizing response time and pricing posture."
          : "Conversion is strong. Preserve response quality and monitor capacity constraints.";

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <OverviewMetric label="Revenue" value={`$${revenue.toFixed(0)}`} />
        <OverviewMetric label="Bookings" value={String(totalBookings)} />
        <OverviewMetric label="Conversion" value={`${conversionRate}%`} />
        <OverviewMetric label="ROI / Lead" value={`$${roi}`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="surface-card p-6">
          <div className="mb-4">
            <p className="section-kicker">Booking Trend</p>
            <h3 className="mt-2 text-lg font-semibold text-[var(--text-strong)]">
              Bookings over time
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={bookingData}>
              <CartesianGrid stroke="rgba(58,47,47,0.7)" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#8f8782" tick={{ fill: "#8f8782", fontSize: 12 }} />
              <YAxis stroke="#8f8782" tick={{ fill: "#8f8782", fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  background: "#171313",
                  border: "1px solid #3A2F2F",
                  borderRadius: "16px",
                  color: "#F5F5F5",
                }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#D4AF37"
                strokeWidth={2.5}
                dot={{ fill: "#E8CC6A", stroke: "#D4AF37", r: 3 }}
                activeDot={{ r: 5, fill: "#E8CC6A" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="surface-card p-6">
          <div className="mb-4">
            <p className="section-kicker">Lead Trend</p>
            <h3 className="mt-2 text-lg font-semibold text-[var(--text-strong)]">
              Lead generation
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={leadData}>
              <CartesianGrid stroke="rgba(58,47,47,0.7)" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#8f8782" tick={{ fill: "#8f8782", fontSize: 12 }} />
              <YAxis stroke="#8f8782" tick={{ fill: "#8f8782", fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  background: "#171313",
                  border: "1px solid #3A2F2F",
                  borderRadius: "16px",
                  color: "#F5F5F5",
                }}
              />
              <Bar dataKey="count" fill="#C1121F" radius={[10, 10, 4, 4]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="premium-card p-6">
        <p className="section-kicker">AI Readout</p>
        <h3 className="mt-2 text-lg font-semibold text-[var(--text-strong)]">
          Operational insight
        </h3>
        <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">{aiInsight}</p>
      </div>
    </section>
  );
}
