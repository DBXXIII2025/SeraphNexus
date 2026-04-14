import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { isRentalBusinessType } from "@/lib/businessModules";
import {
  resolveBookingGrossAmount,
  resolveBookingPlatformFee,
  resolveOrderGrossAmount,
  resolveOrderPlatformFee,
  resolveRentalGrossAmount,
  resolveRentalPlatformFee,
} from "@/lib/paymentMath";
import { formatReservationRange } from "@/lib/rentalAvailability";
import { applyVisibleFilter } from "@/lib/transactionVisibility";
import { createAdminTranslator } from "@/lib/adminI18n";

type OrderRow = {
  id: string;
  customer_name?: string | null;
  customer_email?: string | null;
  fulfillment_type?: string | null;
  created_at?: string | null;
  status?: string | null;
  payment_status?: string | null;
  total_amount?: number | null;
  platform_fee?: number | null;
  stripe_session_id?: string | null;
};

type BookingRow = {
  id: string;
  customer_name?: string | null;
  customer_email?: string | null;
  date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  created_at?: string | null;
  status?: string | null;
  payment_status?: string | null;
  amount_total?: number | null;
  total_amount?: number | null;
  amount?: number | null;
  platform_fee?: number | null;
  stripe_session_id?: string | null;
};

type RentalReservationRow = {
  id: string;
  guest_name?: string | null;
  guest_email?: string | null;
  created_at?: string | null;
  status?: string | null;
  payment_status?: string | null;
  amount_total?: number | null;
  platform_fee?: number | null;
  stripe_session_id?: string | null;
  check_in_date: string;
  check_out_date: string;
};

type CheckoutIntentRow = {
  id: string;
};

type PaymentRow = {
  id: string;
  kind: "order" | "booking";
  label: string;
  detail: string;
  createdAt: string | null;
  status: string | null;
  paymentStatus: string | null;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  stripeSessionId: string | null;
};

type PropertyRow = {
  id: string;
};

type BlockRow = {
  id: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number.isFinite(value) ? value : 0);
}

function getIntentStatusClass(status: string | null | undefined) {
  if (status === "paid" || status === "confirmed") {
    return "border-[rgba(212,175,55,0.22)] bg-[rgba(212,175,55,0.1)] text-[var(--accent-gold-soft)]";
  }

  if (status === "pending") {
    return "border-[rgba(193,18,31,0.22)] bg-[rgba(193,18,31,0.1)] text-[var(--accent-soft)]";
  }

  return "border-[var(--border-soft)] bg-[rgba(31,25,25,0.9)] text-[var(--text-soft)]";
}

export default async function AdminPaymentsPage() {
  const supabase = await createClient();
  const business = await getActiveBusiness();

  if (!business) {
    return <div className="p-6 text-white">{createAdminTranslator(null)("noActiveBusiness")}</div>;
  }

  const t = createAdminTranslator(business.language);

  const isRental = isRentalBusinessType(business.business_type);
  const [
    { data: orders },
    { data: bookingRows },
    { data: intents },
    { data: properties },
    { data: blocks },
  ] = await Promise.all([
    isRental
      ? Promise.resolve({ data: [] as OrderRow[] })
      : applyVisibleFilter(
          supabase
            .from("orders")
            .select("*")
            .eq("business_id", business.id)
            .order("created_at", { ascending: false })
        ),
    isRental
      ? applyVisibleFilter(
          supabase
            .from("rental_reservations")
            .select("*")
            .eq("business_id", business.id)
            .order("created_at", { ascending: false })
        )
      : applyVisibleFilter(
          supabase
            .from("bookings")
            .select("*")
            .eq("business_id", business.id)
            .order("created_at", { ascending: false })
        ),
    isRental
      ? Promise.resolve({ data: [] as CheckoutIntentRow[] })
      : supabase
          .from("checkout_intents")
          .select("*")
          .eq("business_id", business.id)
          .order("created_at", { ascending: false }),
    isRental
      ? supabase.from("property").select("id").eq("business_id", business.id)
      : Promise.resolve({ data: [] as PropertyRow[] }),
    isRental
      ? supabase
          .from("rental_availability_blocks")
          .select("id")
          .eq("business_id", business.id)
      : Promise.resolve({ data: [] as BlockRow[] }),
  ]);

  const safeOrders: OrderRow[] = orders || [];
  const safeIntents: CheckoutIntentRow[] = intents || [];
  const reservationRows: RentalReservationRow[] = isRental
    ? ((bookingRows || []) as RentalReservationRow[])
    : [];
  const serviceBookingRows: BookingRow[] = !isRental
    ? ((bookingRows || []) as BookingRow[])
    : [];
  const propertyRows: PropertyRow[] = (properties || []) as PropertyRow[];
  const blockRows: BlockRow[] = (blocks || []) as BlockRow[];

  const paymentRows: PaymentRow[] = isRental
    ? reservationRows
        .map((reservation) => {
          const grossAmount = resolveRentalGrossAmount(reservation.amount_total);
          const platformFee = resolveRentalPlatformFee(reservation.platform_fee);

          return {
            id: reservation.id,
            kind: "booking" as const,
            label:
              reservation.guest_name ||
              reservation.guest_email ||
              "Reservation payment",
            detail: formatReservationRange(
              reservation.check_in_date,
              reservation.check_out_date
            ),
            createdAt: reservation.created_at,
            status: reservation.status,
            paymentStatus: reservation.payment_status,
            grossAmount,
            platformFee,
            netAmount: grossAmount - platformFee,
            stripeSessionId: reservation.stripe_session_id || null,
          };
        })
        .sort((a, b) => {
          return (
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime()
          );
        })
    : [
        ...safeOrders.map((order) => {
          const grossAmount = resolveOrderGrossAmount(order.total_amount);
          const platformFee = resolveOrderPlatformFee(order.platform_fee);

          return {
            id: order.id,
            kind: "order" as const,
            label: order.customer_name || order.customer_email || "Order payment",
            detail: order.fulfillment_type || "Order",
            createdAt: order.created_at || null,
            status: order.status || null,
            paymentStatus: order.payment_status || null,
            grossAmount,
            platformFee,
            netAmount: grossAmount - platformFee,
            stripeSessionId: order.stripe_session_id || null,
          };
        }),
        ...serviceBookingRows.map((booking) => {
          const grossAmount = resolveBookingGrossAmount(booking);
          const platformFee = resolveBookingPlatformFee(booking.platform_fee);

          return {
            id: booking.id,
            kind: "booking" as const,
            label:
              booking.customer_name ||
              booking.customer_email ||
              "Booking payment",
            detail: booking.date
              ? `${booking.date} ${booking.start_time || ""} ${booking.end_time ? `- ${booking.end_time}` : ""}`.trim()
              : "Booking",
            createdAt: booking.created_at || null,
            status: booking.status || null,
            paymentStatus: booking.payment_status || null,
            grossAmount,
            platformFee,
            netAmount: grossAmount - platformFee,
            stripeSessionId: booking.stripe_session_id || null,
          };
        }),
      ].sort((a, b) => {
        return (
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
      });

  const paidTransactions = paymentRows.filter(
    (row) =>
      row.paymentStatus === "paid" ||
      row.status === "confirmed" ||
      row.status === "paid"
  );
  const pendingTransactions = paymentRows.filter((row) => {
    const status = row.status || "";
    const paymentStatus = row.paymentStatus || "";

    return (
      paymentStatus !== "paid" &&
      status !== "confirmed" &&
      status !== "paid" &&
      status !== "canceled" &&
      status !== "cancelled"
    );
  });
  const cancelledTransactions = paymentRows.filter(
    (row) => row.status === "cancelled" || row.status === "canceled"
  );
  const grossPaidVolume = paidTransactions.reduce(
    (sum, row) => sum + row.grossAmount,
    0
  );
  const totalPlatformFees = paidTransactions.reduce(
    (sum, row) => sum + row.platformFee,
    0
  );
  const netToBusiness = paidTransactions.reduce(
    (sum, row) => sum + row.netAmount,
    0
  );

  if (isRental) {
    console.log("[admin/payments] rental reservation counts:", {
      businessId: business.id,
      businessType: business.business_type || null,
      reservationCount: reservationRows.length,
      paidReservationCount: paidTransactions.length,
      pendingReservationCount: pendingTransactions.length,
      cancelledReservationCount: cancelledTransactions.length,
      blockCount: blockRows.length,
      propertyCount: propertyRows.length,
      totalRentalRevenue: grossPaidVolume,
    });
  } else {
    console.log("[admin/payments] counts:", {
      businessId: business.id,
      businessType: business.business_type || null,
      isRental,
      orders: safeOrders.length,
      bookings: serviceBookingRows.length,
      intents: safeIntents.length,
      paid: paidTransactions.length,
      pending: pendingTransactions.length,
    });
  }

  return (
    <div className="space-y-6 text-[var(--text-main)]">
      <section className="premium-card p-6 lg:p-7">
        <div className="grid gap-6 xl:grid-cols-[1.5fr,0.95fr]">
          <div>
            <p className="section-kicker">{t("payments")}</p>
            <h1 className="mt-3 text-3xl font-semibold text-[var(--text-strong)] lg:text-[2.35rem]">
              {t("payments")} operations
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-soft)]">
              {isRental
                ? "Property and rental businesses settle against finalized reservation records in rental_reservations."
                : "Generic commerce and service businesses settle against orders and service bookings."}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(15,12,12,0.6)] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
              Settlement posture
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(15,12,12,0.64)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {isRental ? "Reservations" : "Transactions"}
              </p>
              <p className="mt-2 text-3xl font-semibold text-[var(--text-strong)]">
                {paymentRows.length}
              </p>
            </div>
            <div className="rounded-2xl border border-[rgba(212,175,55,0.18)] bg-[rgba(212,175,55,0.08)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Gross Paid
              </p>
              <p className="mt-2 text-3xl font-semibold text-[var(--accent-gold-soft)]">
                {formatCurrency(grossPaidVolume)}
              </p>
            </div>
            <div className="rounded-2xl border border-[rgba(193,18,31,0.18)] bg-[rgba(193,18,31,0.1)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Platform Fees
              </p>
              <p className="mt-2 text-3xl font-semibold text-[var(--accent-soft)]">
                {formatCurrency(totalPlatformFees)}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(15,12,12,0.64)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {isRental ? "Paid / Pending" : "Net To Business"}
              </p>
              <p className="mt-2 text-3xl font-semibold text-[var(--text-strong)]">
                {isRental
                  ? `${paidTransactions.length} / ${pendingTransactions.length}`
                  : formatCurrency(netToBusiness)}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(15,12,12,0.64)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {isRental ? "Cancelled / Blocks" : "Paid / Pending"}
              </p>
              <p className="mt-2 text-3xl font-semibold text-[var(--text-strong)]">
                {isRental
                  ? `${cancelledTransactions.length} / ${blockRows.length}`
                  : `${paidTransactions.length} / ${pendingTransactions.length}`}
              </p>
            </div>
            </div>
          </div>
        </div>
      </section>

      <section className="surface-card p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="section-kicker">Recent Transactions</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
              Payment ledger
            </h2>
          </div>
          <span className="text-sm text-[var(--text-soft)]">
            {paymentRows.length} entries
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {paymentRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[rgba(15,12,12,0.62)] px-4 py-8 text-sm text-[var(--text-soft)]">
              No payment activity yet for this business.
            </div>
          ) : (
            paymentRows.map((row) => (
              <div key={`${row.kind}-${row.id}`} className="table-row-panel p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-[var(--text-strong)]">{row.label}</p>
                    <p className="mt-1 text-sm text-[var(--text-soft)]">{row.detail}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] px-3 py-1 text-[var(--text-soft)]">
                        Gross {formatCurrency(row.grossAmount)}
                      </span>
                      <span className="rounded-full border border-[rgba(193,18,31,0.16)] bg-[rgba(193,18,31,0.08)] px-3 py-1 text-[var(--accent-soft)]">
                        Fee {formatCurrency(row.platformFee)}
                      </span>
                      <span className="rounded-full border border-[rgba(212,175,55,0.16)] bg-[rgba(212,175,55,0.08)] px-3 py-1 text-[var(--accent-gold-soft)]">
                        Net {formatCurrency(row.netAmount)}
                      </span>
                    </div>
                    {row.stripeSessionId ? (
                      <p className="mt-2 text-xs text-[var(--text-muted)]">
                        Session {row.stripeSessionId}
                      </p>
                    ) : null}
                  </div>

                  <div className="text-right">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium capitalize ${getIntentStatusClass(
                        row.paymentStatus || row.status
                      )}`}
                    >
                      {row.paymentStatus || row.status || "pending"}
                    </span>
                    <p className="mt-3 text-xs text-[var(--text-muted)]">
                      {row.createdAt
                        ? new Date(row.createdAt).toLocaleString()
                        : "No timestamp"}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
