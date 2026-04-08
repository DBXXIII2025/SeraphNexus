function getBookingAmount(booking: any) {
  if (typeof booking?.amount_total === "number" && booking.amount_total > 0) {
    return booking.amount_total / 100;
  }

  if (typeof booking?.total_amount === "number" && booking.total_amount > 0) {
    return booking.total_amount > 1000 ? booking.total_amount / 100 : booking.total_amount;
  }

  return 0;
}

function getBookingDate(booking: any) {
  return booking?.date || booking?.check_in_date || null;
}

export function predictRevenue(bookings: any[]) {
  const paid = bookings.filter(
    (b) => b.payment_status === "paid" || b.status === "confirmed"
  );

  if (paid.length < 3) {
    return "Not enough data for prediction";
  }

  const avg =
    paid.reduce((sum, b) => sum + getBookingAmount(b), 0) /
    paid.length;

  const projected = avg * 30; // monthly estimate

  return `Projected monthly revenue: $${projected.toFixed(2)}`;
}

function groupRevenuePerDay(bookings: any[]) {
  const map: Record<string, number> = {};

  bookings.forEach((b) => {
    const key = getBookingDate(b);
    if (!key) return;
    map[key] = (map[key] || 0) + getBookingAmount(b);
  });

  return Object.entries(map)
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => (a.date > b.date ? 1 : -1));
}

function getPeakHours(bookings: any[]) {
  const map: Record<number, number> = {};

  bookings.forEach((b) => {
    if (!b.start_time) return;
    const hour = Number(b.start_time.split(":")[0]);
    if (Number.isNaN(hour)) return;
    map[hour] = (map[hour] || 0) + 1;
  });

  return Object.entries(map)
    .map(([hour, count]) => ({ hour: Number(hour), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

function getSuggestedPricingChanges(bookings: any[]) {
  const hourlyCounts: Record<number, number> = {};

  bookings.forEach((b) => {
    if (!b.start_time) return;
    const hour = Number(b.start_time.split(":")[0]);
    if (Number.isNaN(hour)) return;
    hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1;
  });

  const entries = Object.entries(hourlyCounts)
    .map(([hour, count]) => ({ hour: Number(hour), count }))
    .sort((a, b) => b.count - a.count);

  const top = entries.slice(0, 2);
  const low = entries.slice(-2);

  const suggestions: string[] = [];

  top.forEach((h) => {
    suggestions.push(`Increase prices around ${String(h.hour).padStart(2, "0")}:00`);
  });

  low.forEach((h) => {
    if (h.count <= 1) {
      suggestions.push(`Offer discounts around ${String(h.hour).padStart(2, "0")}:00`);
    }
  });

  if (suggestions.length === 0) {
    suggestions.push("Pricing is balanced across hours.");
  }

  return suggestions;
}

export function generateInsights({ bookings, leads }: { bookings: any[]; leads: any[] }) {
  const paid = bookings.filter(
    (b) => b.payment_status === "paid" || b.status === "confirmed"
  );

  const revenue = paid.reduce((sum, b) => sum + getBookingAmount(b), 0);

  const totalBookings = bookings.length;
  const avgBookingValue = totalBookings > 0 ? revenue / totalBookings : 0;

  const totalLeads = leads.length;
  const confirmedBookings = bookings.filter((b) => b.status === "confirmed").length;

  const conversionRate = totalLeads > 0 ? (confirmedBookings / totalLeads) * 100 : 0;

  const hotLeadCount = leads.filter((l) => l.temperature === "hot").length;

  const revenuePerDay = groupRevenuePerDay(paid);
  const peakHours = getPeakHours(bookings);
  const suggestedPricingChanges = getSuggestedPricingChanges(bookings);

  return {
    revenue,
    avgBookingValue,
    conversionRate,
    hotLeadCount,
    revenuePerDay,
    peakHours,
    suggestedPricingChanges,
  };
}
