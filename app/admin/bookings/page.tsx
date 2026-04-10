import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import {
  getBusinessModule,
  isBookingBusinessType,
  isRentalBusinessType,
} from "@/lib/businessModules";
import {
  formatReservationRange,
  getBookingDisplayRange,
  getReservationGuestLabel,
} from "@/lib/rentalAvailability";
import {
  formatAdminStatusLabel,
  getAdminActionButtonClass,
  getAdminStatusBadgeClass,
} from "@/lib/adminStatus";
import { applyVisibleFilter } from "@/lib/transactionVisibility";

type ServiceBookingRecord = {
  id: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  amount: number;
  createdAt: string | null;
  date: string;
  startTime: string;
  endTime: string;
  serviceName: string | null;
  serviceDetails: string[];
  serviceMode: string | null;
  address: string | null;
  notes: string | null;
  status: string | null;
  paymentStatus: string | null;
  conversationHref: string | null;
  isFallback: boolean;
};

type BookingFallbackRow = {
  id: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  amount: number;
  paid: string;
  createdAt: string | null;
  date: string;
  endDate: string | null;
  startTime: string;
  endTime: string;
  propertyId: string | null;
  reservationType: "rental" | "service";
  serviceName: string | null;
  serviceDetails: string[];
  serviceMode: string | null;
  address: string | null;
  notes: string | null;
};

type LooseRow = Record<string, unknown>;

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asNumber(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function formatAddress(address: unknown) {
  const record = asRecord(address);
  const parts = [
    asString(record.line1),
    asString(record.line2),
    asString(record.city),
    asString(record.state),
    asString(record.postalCode),
  ].filter((value): value is string => Boolean(value));

  return parts.length > 0 ? parts.join(", ") : null;
}

function formatServiceSchedule(
  date: string | null | undefined,
  startTime?: string | null,
  endTime?: string | null
) {
  if (!date) return "Date pending";

  const parts = [date];
  if (startTime || endTime) {
    parts.push(`${startTime || "--:--"} - ${endTime || "--:--"}`);
  }

  return parts.join(" ");
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "No timestamp";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function collectServiceDetails(metadata: Record<string, unknown>) {
  const details: string[] = [];
  const duration = asNumber(metadata.service_duration);
  const price = asNumber(metadata.service_price);

  if (duration > 0) {
    details.push(`${duration} min`);
  }
  if (price > 0) {
    details.push(`$${price.toFixed(2)}`);
  }

  return details;
}

function formatPaymentLabel(paymentStatus: string | null | undefined) {
  return formatAdminStatusLabel(paymentStatus, "Pending");
}

function isAwaitingServiceAction(record: ServiceBookingRecord) {
  return (
    record.status !== "confirmed" &&
    record.status !== "completed" &&
    record.status !== "cancelled" &&
    record.paymentStatus !== "refunded"
  );
}

function getReservationActions(status: string | null | undefined) {
  if (status === "completed" || status === "cancelled") {
    return [];
  }

  if (status === "confirmed") {
    return [
      {
        label: "Mark stay completed",
        status: "completed",
        className: getAdminActionButtonClass("warning"),
      },
      {
        label: "Cancel reservation",
        status: "cancelled",
        className: getAdminActionButtonClass("danger"),
      },
    ];
  }

  return [
    {
      label: "Approve reservation",
      status: "confirmed",
      className: getAdminActionButtonClass("success"),
    },
    {
      label: "Cancel reservation",
      status: "cancelled",
      className: getAdminActionButtonClass("danger"),
    },
  ];
}

function SummaryCard({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "success" | "alert";
}) {
  const valueClass =
    tone === "success"
      ? "text-emerald-300"
      : tone === "alert"
        ? "text-amber-300"
        : "text-white";

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-5">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${valueClass}`}>{value}</p>
      <p className="mt-2 text-sm text-gray-400">{detail}</p>
    </div>
  );
}

function renderServiceCard(record: ServiceBookingRecord) {
  return (
    <div
      key={record.id}
      className={`rounded-2xl border p-5 ${
        record.isFallback
          ? "border-yellow-500/20 bg-yellow-500/10"
          : "border-white/10 bg-zinc-900/70"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-semibold">{record.customerName}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium capitalize ${getAdminStatusBadgeClass(
                record.status
              )}`}
            >
              {formatAdminStatusLabel(record.status, "Pending")}
            </span>
            <span className="inline-flex rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-medium capitalize text-gray-300">
              Payment {formatPaymentLabel(record.paymentStatus)}
            </span>
          </div>
          {record.isFallback ? (
            <p className="mt-2 text-sm text-yellow-200">
              Paid checkout captured before booking materialization.
            </p>
          ) : null}
        </div>

        <div className="text-right">
          <p className="text-lg font-semibold">${record.amount.toFixed(2)}</p>
          <p className="text-xs text-gray-500">{formatTimestamp(record.createdAt)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Customer
          </p>
          <div className="mt-2 space-y-1 text-sm text-gray-200">
            <p>Name: {record.customerName}</p>
            <p>Email: {record.customerEmail || "No email provided"}</p>
            <p>Phone: {record.customerPhone || "No phone provided"}</p>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Appointment
          </p>
          <div className="mt-2 space-y-2 text-sm text-gray-200">
            <p>Service: {record.serviceName || "Service details unavailable"}</p>
            {record.serviceDetails.length > 0 ? (
              <p>{record.serviceDetails.join(" | ")}</p>
            ) : null}
            <p>
              Scheduled:{" "}
              {formatServiceSchedule(record.date, record.startTime, record.endTime)}
            </p>
            <p>Mode: {record.serviceMode || "Pending"}</p>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Location / Notes
          </p>
          <div className="mt-2 space-y-2 text-sm text-gray-200">
            <p>{record.address || "No address required for this booking."}</p>
            <p>Notes: {record.notes || "No special instructions."}</p>
          </div>
        </div>
      </div>

      {!record.isFallback ? (
        <div className="mt-4 flex flex-wrap gap-3">
          {record.conversationHref ? (
            <Link
              href={record.conversationHref}
              className="rounded-md border border-amber-500/30 px-3 py-2 text-sm font-medium text-amber-300 hover:bg-amber-500/10"
            >
              Reply to customer
            </Link>
          ) : null}

          {record.status !== "confirmed" ? (
            <form action="/api/bookings/update-status" method="POST">
              <input type="hidden" name="id" value={record.id} />
              <input type="hidden" name="status" value="confirmed" />
              <button
                type="submit"
                className={getAdminActionButtonClass("success")}
              >
                Approve booking
              </button>
            </form>
          ) : null}

          {record.status !== "cancelled" ? (
            <form action="/api/bookings/update-status" method="POST">
              <input type="hidden" name="id" value={record.id} />
              <input type="hidden" name="status" value="cancelled" />
              <button
                type="submit"
                className={getAdminActionButtonClass("danger")}
              >
                Cancel booking
              </button>
            </form>
          ) : null}

          {record.status !== "cancelled" ? (
            <form
              action="/api/bookings/reschedule"
              method="POST"
              className="flex flex-wrap items-center gap-2"
            >
              <input type="hidden" name="id" value={record.id} />
              <input
                type="datetime-local"
                name="new_time"
                className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                aria-label={`Reschedule ${record.customerName}`}
              />
              <button
                type="submit"
                className={getAdminActionButtonClass("neutral")}
              >
                Reschedule booking
              </button>
            </form>
          ) : null}

          <form action="/api/bookings/refund" method="POST">
            <input type="hidden" name="id" value={record.id} />
            <button
              type="submit"
              className={getAdminActionButtonClass("neutral")}
            >
              Issue refund
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export default async function AdminBookingsPage() {
  const supabase = await createClient();
  const business = await getActiveBusiness();
  const isDev = process.env.NODE_ENV !== "production";

  if (!business) {
    return <div className="text-white">No active business</div>;
  }

  if (!isBookingBusinessType(business.business_type)) {
    return (
      <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-6 text-white">
        Bookings are only available for service, rental, and property businesses.
      </div>
    );
  }

  const isRental = isRentalBusinessType(business.business_type);

  const [{ data: rows }, { data: conversations }, { data: properties }, { data: intentRows }] =
    await Promise.all([
      isRental
        ? applyVisibleFilter(
            supabase
              .from("rental_reservations")
              .select("*")
              .eq("business_id", business.id)
              .order("check_in_date", { ascending: true })
          )
        : applyVisibleFilter(
            supabase
              .from("bookings")
              .select("*")
              .eq("business_id", business.id)
              .order("date", { ascending: true })
              .order("start_time", { ascending: true })
          ),
      supabase
        .from("conversations")
        .select("id, booking_id")
        .eq("business_id", business.id),
      isRental
        ? supabase.from("property").select("id, name").eq("business_id", business.id)
        : Promise.resolve({ data: [] as LooseRow[] }),
      supabase
        .from("checkout_intents")
        .select("*")
        .eq("business_id", business.id),
    ]);

  const intentsBySessionId = new Map<string, LooseRow>();
  const intentsByBookingId = new Map<string, LooseRow>();
  (intentRows || []).forEach((intent: LooseRow) => {
    const metadata = asRecord(intent.metadata ?? intent.meta_json);
    const sessionId = asString(intent.stripe_checkout_session_id);
    const bookingId = asString(intent.booking_id) || asString(metadata.booking_id);

    if (sessionId) {
      intentsBySessionId.set(sessionId, intent);
    }
    if (bookingId) {
      intentsByBookingId.set(bookingId, intent);
    }
  });

  const paidIntents = (intentRows || []).filter(
    (intent: LooseRow) => String(intent.status || "") === "paid"
  );
  const conversationIdByBookingId = new Map(
    (conversations || []).map((row: LooseRow) => [String(row.booking_id || ""), String(row.id)])
  );

  const fallbackRows: BookingFallbackRow[] = isRental
    ? paidIntents
        .filter((intent: LooseRow) => {
          const kind = String(intent.kind || intent.intent_type || "");
          return kind === "booking";
        })
        .filter((intent: LooseRow) => {
          const metadata = asRecord(intent.metadata ?? intent.meta_json);
          const isRentalIntent =
            asString(metadata.reservation_type) === "rental" ||
            asString(metadata.flow_type) === "rental_reservation";
          if (!isRentalIntent) {
            return false;
          }

          const sessionId = String(intent.stripe_checkout_session_id || "");
          return !(rows || []).some(
            (row: LooseRow) => String(row.stripe_session_id || "") === sessionId
          );
        })
        .map((intent: LooseRow) => {
          const metadata = asRecord(intent.metadata ?? intent.meta_json);

          return {
            id: String(intent.id),
            customerName: String(
              intent.customer_name ||
                asString(metadata.guest_name) ||
                intent.customer_email ||
                asString(metadata.guest_email) ||
                "Customer"
            ),
            customerEmail:
              asString(intent.customer_email) ||
              asString(metadata.guest_email) ||
              null,
            customerPhone:
              asString(intent.phone) ||
              asString(metadata.guest_phone) ||
              asString(metadata.phone) ||
              null,
            amount: asNumber(intent.amount_total ?? intent.total_cents) / 100,
            paid: String(intent.status || "paid"),
            createdAt: asString(intent.created_at),
            date:
              asString(metadata.check_in_date) ||
              asString(metadata.start_date) ||
              asString(metadata.date) ||
              "Date pending",
            endDate: asString(metadata.check_out_date) || asString(metadata.end_date),
            startTime: asString(metadata.start_time) || "--:--",
            endTime: asString(metadata.end_time) || "--:--",
            propertyId: asString(metadata.property_id),
            reservationType: "rental",
            serviceName: asString(metadata.service_name),
            serviceDetails: collectServiceDetails(metadata),
            serviceMode:
              asString(metadata.service_mode) || asString(metadata.fulfillment_type),
            address: formatAddress(intent.address_json ?? metadata.address),
            notes: asString(metadata.notes),
          };
        })
    : [];

  const normalizedServiceRows: ServiceBookingRecord[] = isRental
    ? []
    : ((rows || []) as LooseRow[]).map((row: LooseRow) => {
        const intent =
          intentsByBookingId.get(String(row.id)) ||
          intentsBySessionId.get(String(row.stripe_session_id || ""));
        const metadata = asRecord(intent?.metadata ?? intent?.meta_json);
        const amountCents = asNumber(
          row.amount_total ?? row.total_amount ?? intent?.amount_total ?? 0
        );

        return {
          id: String(row.id),
          customerName: String(
            row.customer_name ||
              row.guest_name ||
              asString(metadata.customer_name) ||
              asString(metadata.guest_name) ||
              "Customer"
          ),
          customerEmail:
            asString(row.customer_email) ||
            asString(row.guest_email) ||
            asString(intent?.customer_email) ||
            asString(metadata.customer_email) ||
            asString(metadata.guest_email) ||
            null,
          customerPhone:
            asString(row.phone) ||
            asString(row.guest_phone) ||
            asString(intent?.phone) ||
            asString(metadata.customer_phone) ||
            asString(metadata.guest_phone) ||
            asString(metadata.phone) ||
            null,
          amount: amountCents / 100,
          createdAt: asString(row.created_at),
          date: asString(row.date) || "Date pending",
          startTime: asString(row.start_time) || "--:--",
          endTime: asString(row.end_time) || "--:--",
          serviceName: asString(metadata.service_name),
          serviceDetails: collectServiceDetails(metadata),
          serviceMode:
            asString(metadata.service_mode) ||
            asString(metadata.fulfillment_type),
          address:
            asString(row.client_address) ||
            formatAddress(intent?.address_json ?? metadata.address),
          notes: asString(metadata.notes),
          status: asString(row.status),
          paymentStatus: asString(row.payment_status),
          conversationHref: conversationIdByBookingId.get(String(row.id))
            ? `/admin/messages?businessId=${encodeURIComponent(
                business.id
              )}&conversation=${encodeURIComponent(
                String(conversationIdByBookingId.get(String(row.id)))
              )}`
            : null,
          isFallback: false,
        };
      });

  if (isDev) {
    if (isRental) {
      const reservationRows = (rows || []) as LooseRow[];
      const paidReservationCount = reservationRows.filter(
        (row) => row.payment_status === "paid" || row.status === "confirmed"
      ).length;
      const pendingReservationCount = reservationRows.filter(
        (row) =>
          row.status !== "confirmed" &&
          row.status !== "cancelled" &&
          row.payment_status !== "paid"
      ).length;
      const cancelledReservationCount = reservationRows.filter(
        (row) => row.status === "cancelled"
      ).length;

      console.log("[admin/bookings] rental reservation counts:", {
        businessId: business.id,
        businessType: business.business_type || null,
        reservationCount: reservationRows.length,
        paidReservationCount,
        pendingReservationCount,
        cancelledReservationCount,
        propertyCount: properties?.length || 0,
        paidIntentFallbackCount: fallbackRows.length,
      });
    } else {
      const serviceRows = (rows || []) as LooseRow[];
      const confirmedBookingCount = serviceRows.filter(
        (row) => row.status === "confirmed"
      ).length;

      console.log("[admin/bookings] service fulfillment load counts:", {
        businessId: business.id,
        businessType: business.business_type || null,
        bookingCount: serviceRows.length,
        confirmedBookingCount,
        pendingBookingCount: normalizedServiceRows.filter((row) => isAwaitingServiceAction(row)).length,
        withAddressCount: normalizedServiceRows.filter((row) => Boolean(row.address)).length,
        withNotesCount: normalizedServiceRows.filter((row) => Boolean(row.notes)).length,
        withServiceDetailsCount: normalizedServiceRows.filter((row) => Boolean(row.serviceName)).length,
        paidIntentFallbackCount: fallbackRows.length,
      });
    }
  }

  const businessModule = getBusinessModule(business.business_type);
  const propertyNameById = new Map(
    (properties || []).map((property: LooseRow) => [
      String(property.id),
      asString(property.name) || "Listing",
    ])
  );
  const pageTitle = isRental ? "Reservations" : "Bookings";
  const serviceRecords = normalizedServiceRows.filter((row) => !row.isFallback);
  const serviceConfirmedCount = serviceRecords.filter((row) => row.status === "confirmed").length;
  const servicePendingCount = serviceRecords.filter((row) => isAwaitingServiceAction(row)).length;
  const rentalRows = isRental ? ((rows || []) as LooseRow[]) : [];
  const rentalConfirmedCount = rentalRows.filter((row) => row.status === "confirmed").length;
  const rentalPendingCount = rentalRows.filter((row) => row.status === "pending").length;

  return (
    <div className="space-y-6 text-white">
      <section className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-gray-500">{pageTitle}</p>
        <h1 className="mt-2 text-2xl font-semibold">{pageTitle} queue</h1>
        <p className="mt-3 text-sm leading-6 text-gray-400">
          {businessModule.label} operations for {business.name}.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label={isRental ? "Active reservations" : "Live bookings"}
          value={String(isRental ? rentalRows.length : serviceRecords.length)}
          detail={
            isRental
              ? "Reservations scoped to the active rental business."
              : "Appointments scoped to the active service business."
          }
        />
        <SummaryCard
          label="Awaiting action"
          value={String(isRental ? rentalPendingCount : servicePendingCount)}
          detail={
            isRental
              ? "Reservations still pending confirmation or cancellation."
              : "Bookings still pending confirmation or rescheduling."
          }
          tone="alert"
        />
        <SummaryCard
          label={isRental ? "Confirmed stays" : "Confirmed bookings"}
          value={
            isRental
              ? String(rentalConfirmedCount)
              : String(serviceConfirmedCount)
          }
          detail={
            isRental
              ? "Confirmed reservations still active in the current queue."
              : "Bookings already confirmed with the customer."
          }
          tone="success"
        />
      </div>

      {(!rows || rows.length === 0) && fallbackRows.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-6 text-sm text-gray-400">
          {isRental
            ? "No reservations yet. When guests book a stay, it will appear here with status actions."
            : "No bookings yet. When customers schedule an appointment, it will appear here with confirmation controls."}
        </div>
      ) : (
        <div className="space-y-4">
          {isRental
            ? (rows || []).map((row: LooseRow) => {
                const rowId = String(row.id || "");
                const rowStatus = asString(row.status) || "pending";
                const rowCreatedAt = asString(row.created_at);
                const rowPropertyId = asString(row.property_id);
                const rowAmount = Number(row.amount_total || 0) / 100;
                const guestName = asString(row.guest_name) || "Unknown";
                const guestEmail = asString(row.guest_email) || "No email";
                const guestPhone = asString(row.guest_phone) || "No phone";
                const displayRange = getBookingDisplayRange(row);

                return (
                  <div
                    key={rowId}
                    className="rounded-xl border border-white/10 bg-zinc-900/70 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="font-semibold">{getReservationGuestLabel(row)}</p>
                        <p className="text-sm text-gray-400">
                          {formatReservationRange(
                            displayRange?.startDate || asString(row.check_in_date),
                            displayRange?.endDate || asString(row.check_out_date)
                          )}
                        </p>
                        {rowPropertyId ? (
                          <p className="text-sm text-gray-400">
                            {propertyNameById.get(rowPropertyId) || "Listing"}
                          </p>
                        ) : null}
                        <p className="text-sm text-gray-400">
                          Guest: {guestName} | Email: {guestEmail} | Phone: {guestPhone}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium capitalize ${getAdminStatusBadgeClass(
                              rowStatus
                            )}`}
                          >
                            {formatAdminStatusLabel(rowStatus, "Pending")}
                          </span>
                          <span className="inline-flex rounded-full border border-[var(--border-soft)] bg-[rgba(31,25,25,0.9)] px-3 py-1 text-xs font-medium text-[var(--text-soft)] capitalize">
                            Payment {formatPaymentLabel(asString(row.payment_status))}
                          </span>
                          <span className="inline-flex rounded-full border border-[rgba(212,175,55,0.18)] bg-[rgba(212,175,55,0.08)] px-3 py-1 text-xs font-medium text-[var(--accent-gold-soft)]">
                            ${rowAmount.toFixed(2)}
                          </span>
                        </div>
                        {conversationIdByBookingId.get(rowId) ? (
                          <Link
                            href={`/admin/messages?businessId=${encodeURIComponent(
                              business.id
                            )}&conversation=${encodeURIComponent(
                              String(conversationIdByBookingId.get(rowId))
                            )}`}
                          className="mt-3 inline-flex text-sm font-medium text-[var(--accent-soft)] hover:text-[var(--accent-gold-soft)]"
                        >
                          Reply to customer
                        </Link>
                      ) : null}
                        <div className="mt-4 flex flex-wrap gap-3">
                          {getReservationActions(rowStatus).map((action) => (
                            <form
                              key={`${rowId}-${action.status}`}
                              action="/api/admin/rentals/reservations/status"
                              method="POST"
                            >
                              <input type="hidden" name="id" value={rowId} />
                              <input type="hidden" name="status" value={action.status} />
                              <button type="submit" className={action.className}>
                                {action.label}
                              </button>
                            </form>
                          ))}
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-lg font-semibold">${rowAmount.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">
                          {formatTimestamp(rowCreatedAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            : normalizedServiceRows.map((record) => renderServiceCard(record))}

          {isRental
            ? fallbackRows
                .filter((row) => row.reservationType === "rental")
                .map((row) => (
                  <div
                    key={`fallback-${row.id}`}
                    className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="font-semibold">{row.customerName}</p>
                        <p className="text-sm text-yellow-100">
                          {formatReservationRange(row.date, row.endDate)}
                        </p>
                        {row.propertyId ? (
                          <p className="text-sm text-yellow-100">
                            {propertyNameById.get(String(row.propertyId)) || "Listing"}
                          </p>
                        ) : null}
                        <p className="text-sm text-yellow-200">
                          Paid checkout captured before reservation materialization.
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-lg font-semibold">
                          ${row.amount.toFixed(2)}
                        </p>
                        <p className="text-xs text-yellow-200">
                          {formatTimestamp(row.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
            : fallbackRows
                .filter((row) => row.reservationType === "service")
                .map((row) =>
                  renderServiceCard({
                    id: row.id,
                    customerName: row.customerName,
                    customerEmail: row.customerEmail,
                    customerPhone: row.customerPhone,
                    amount: row.amount,
                    createdAt: row.createdAt,
                    date: row.date,
                    startTime: row.startTime,
                    endTime: row.endTime,
                    serviceName: row.serviceName,
                    serviceDetails: row.serviceDetails,
                    serviceMode: row.serviceMode,
                    address: row.address,
                    notes: row.notes,
                    status: "pending",
                    paymentStatus: row.paid,
                    conversationHref: null,
                    isFallback: true,
                  })
                )}
        </div>
      )}
    </div>
  );
}
