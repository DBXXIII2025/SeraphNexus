import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import {
  getBusinessModule,
  isBookingBusinessType,
  isOrderBusinessType,
  isRentalBusinessType,
} from "@/lib/businessModules";
import {
  asArray,
  asNumber,
  asRecord,
  asString,
  compactCustomerSummary,
  formatAddress,
  formatCurrency,
  formatDateLabel,
  formatTimeLabel,
  titleCaseStatus,
} from "@/lib/transactionConfirmation";
import InAppTransactionCard, {
  type InAppTransactionSection,
} from "@/components/confirmation/InAppTransactionCard";
import { applyVisibleFilter } from "@/lib/transactionVisibility";
import {
  AdminPageContainer,
  DashboardGrid,
  DashboardPrimaryPanel,
} from "@/components/admin/AdminLayoutSystem";
import { EmptyState, SectionHeader, StatCard } from "@/components/ui/app-ui";

type TransactionCardRecord = {
  id: string;
  badge: string;
  tone: "confirmed" | "pending" | "attention";
  title: string;
  subtitle: string;
  amount: string | null;
  meta: string | null;
  sections: InAppTransactionSection[];
};

function getStatusTone(status: string | null, paymentStatus: string | null) {
  if (status === "cancelled" || status === "canceled" || paymentStatus === "refunded") {
    return "attention" as const;
  }

  if (paymentStatus === "paid" || status === "confirmed" || status === "completed") {
    return "confirmed" as const;
  }

  return "pending" as const;
}

function buildServiceTitle(
  serviceName: string | null,
  date: string | null,
  startTime: string | null,
  endTime: string | null
) {
  const timeWindow = [formatTimeLabel(startTime), formatTimeLabel(endTime)]
    .filter(Boolean)
    .join(" - ");
  const dateLabel = formatDateLabel(date);

  return [serviceName || "Service booking", dateLabel, timeWindow]
    .filter(Boolean)
    .join(" | ");
}

function buildOrderItemsSummary(
  orderItems: Array<{ name: string; quantity: number; price: number | null }>
) {
  if (orderItems.length === 0) {
    return "Items confirmed";
  }

  return orderItems.map((item) => `${item.name} x${item.quantity}`).join(", ");
}

export default async function TransactionsPage() {
  const supabase = await createClient();
  const business = await getActiveBusiness();

  if (!business) {
    return (
      <AdminPageContainer className="text-[var(--text-main)]">
        <EmptyState
          title="No active business found"
          description="Select or create a business before reviewing transactions."
        />
      </AdminPageContainer>
    );
  }

  const businessModule = getBusinessModule(business.business_type);
  const isRental = isRentalBusinessType(business.business_type);
  const isBooking = isBookingBusinessType(business.business_type);
  const isOrder = isOrderBusinessType(business.business_type);

  const [{ data: intentRows }, { data: properties }] = await Promise.all([
    supabase
      .from("checkout_intents")
      .select("id, booking_id, order_id, stripe_checkout_session_id, metadata, meta_json, address_json, order_items")
      .eq("business_id", business.id),
    isRental
      ? supabase.from("property").select("id, name").eq("business_id", business.id)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string | null }> }),
  ]);

  const intentByBookingId = new Map<string, Record<string, unknown>>();
  const intentByOrderId = new Map<string, Record<string, unknown>>();
  const intentBySessionId = new Map<string, Record<string, unknown>>();

  (intentRows || []).forEach((intent) => {
    const record = intent as unknown as Record<string, unknown>;
    const metadata = asRecord(record.metadata ?? record.meta_json);
    const bookingId = asString(record.booking_id) || asString(metadata.booking_id);
    const orderId = asString(record.order_id) || asString(metadata.order_id);
    const sessionId = asString(record.stripe_checkout_session_id);

    if (bookingId) {
      intentByBookingId.set(bookingId, record);
    }
    if (orderId) {
      intentByOrderId.set(orderId, record);
    }
    if (sessionId) {
      intentBySessionId.set(sessionId, record);
    }
  });

  const propertyNameById = new Map(
    (properties || []).map((property) => [String(property.id), property.name || "Listing"])
  );

  const cards: TransactionCardRecord[] = [];

  if (isBooking && !isRental) {
    const { data: bookings } = await applyVisibleFilter(
      supabase
        .from("bookings")
        .select("*")
        .eq("business_id", business.id)
        .order("date", { ascending: false })
        .order("start_time", { ascending: false })
    );

    for (const row of bookings || []) {
      const record = row as unknown as Record<string, unknown>;
      const intent =
        intentByBookingId.get(String(record.id || "")) ||
        intentBySessionId.get(String(record.stripe_session_id || ""));
      const metadata = asRecord(intent?.metadata ?? intent?.meta_json);
      const customerSummary = compactCustomerSummary({
        name: asString(record.customer_name),
        email:
          asString(record.customer_email) ||
          asString(metadata.customer_email) ||
          asString(metadata.guest_email),
        phone:
          asString(record.phone) ||
          asString(metadata.customer_phone) ||
          asString(metadata.guest_phone) ||
          asString(metadata.phone),
      });
      const paymentStatus =
        titleCaseStatus(asString(record.payment_status)) || "Pending";
      const bookingStatus = titleCaseStatus(asString(record.status)) || "Pending";
      const serviceMode =
        titleCaseStatus(asString(metadata.service_mode)) ||
        titleCaseStatus(asString(metadata.fulfillment_type));
      const amount = formatCurrency(asNumber(record.amount));
      const address =
        asString(record.client_address) ||
        formatAddress(intent?.address_json ?? metadata.address);

      cards.push({
        id: `booking-${record.id}`,
        badge: bookingStatus,
        tone: getStatusTone(asString(record.status), asString(record.payment_status)),
        title: buildServiceTitle(
          asString(metadata.service_name),
          asString(record.date),
          asString(record.start_time),
          asString(record.end_time)
        ),
        subtitle: "Completed and in-progress service bookings for this business.",
        amount,
        meta: paymentStatus,
        sections: [
          {
            title: "Who",
            items: customerSummary
              ? [{ label: "Customer", value: customerSummary }]
              : [],
          },
          {
            title: "What",
            items: [
              {
                label: "Service",
                value: asString(metadata.service_name) || "Service booking",
              },
              ...(serviceMode ? [{ label: "Mode", value: serviceMode }] : []),
            ],
          },
          {
            title: "When",
            items: [
              {
                label: "Date",
                value: formatDateLabel(asString(record.date)) || "Date pending",
              },
              {
                label: "Time",
                value:
                  [formatTimeLabel(asString(record.start_time)), formatTimeLabel(asString(record.end_time))]
                    .filter(Boolean)
                    .join(" - ") || "Time pending",
              },
            ],
          },
          {
            title: "Where",
            items: address
              ? [{ label: "Location", value: address }]
              : serviceMode
                ? [{ label: "Location", value: serviceMode === "Remote" ? "Remote service" : "Onsite service" }]
                : [],
          },
          {
            title: "Payment",
            items: [
              ...(amount ? [{ label: "Total", value: amount }] : []),
              { label: "Payment status", value: paymentStatus },
            ],
          },
        ],
      });
    }
  }

  if (isRental) {
    const { data: reservations } = await applyVisibleFilter(
      supabase
        .from("rental_reservations")
        .select("*")
        .eq("business_id", business.id)
        .order("check_in_date", { ascending: false })
    );

    for (const row of reservations || []) {
      const record = row as unknown as Record<string, unknown>;
      const customerSummary = compactCustomerSummary({
        name: asString(record.guest_name),
        email: asString(record.guest_email),
        phone: asString(record.guest_phone),
      });
      const paymentStatus =
        titleCaseStatus(asString(record.payment_status)) || "Pending";
      const reservationStatus =
        titleCaseStatus(asString(record.status)) || "Pending";
      const amount =
        formatCurrency(asNumber(record.amount_total) / 100) ||
        formatCurrency(asNumber(record.amount_total));

      cards.push({
        id: `reservation-${record.id}`,
        badge: reservationStatus,
        tone: getStatusTone(asString(record.status), asString(record.payment_status)),
        title:
          propertyNameById.get(String(record.property_id || "")) || "Rental reservation",
        subtitle: "Reservation details from the source-of-truth rental reservation record.",
        amount,
        meta: paymentStatus,
        sections: [
          {
            title: "Who",
            items: customerSummary
              ? [{ label: "Guest", value: customerSummary }]
              : [],
          },
          {
            title: "What",
            items: [
              {
                label: "Listing",
                value:
                  propertyNameById.get(String(record.property_id || "")) ||
                  "Reserved stay",
              },
            ],
          },
          {
            title: "When",
            items: [
              {
                label: "Check-in",
                value:
                  formatDateLabel(asString(record.check_in_date)) ||
                  "Check-in pending",
              },
              {
                label: "Check-out",
                value:
                  formatDateLabel(asString(record.check_out_date)) ||
                  "Check-out pending",
              },
            ],
          },
          {
            title: "Where",
            items: [
              {
                label: "Property",
                value:
                  propertyNameById.get(String(record.property_id || "")) ||
                  "Listing",
              },
            ],
          },
          {
            title: "Payment",
            items: [
              ...(amount ? [{ label: "Total", value: amount }] : []),
              { label: "Payment status", value: paymentStatus },
            ],
          },
        ],
      });
    }
  }

  if (isOrder) {
    const ordersTable = supabase.from("orders") as unknown as {
      select: (query: string) => {
        eq: (column: string, value: string) => {
          order: (
            columnName: string,
            options: { ascending: boolean }
          ) => Promise<{ data: Record<string, unknown>[] | null }>;
        };
      };
    };

    const { data: orders } = await applyVisibleFilter(
      ordersTable
        .select("*")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false })
    );

    const orderIds = (orders || []).map((order) => String(order.id || ""));
    let orderItemsByOrderId = new Map<
      string,
      Array<{ name: string; quantity: number; price: number | null }>
    >();

    if (orderIds.length > 0) {
      try {
        const orderItemsTable = supabase.from("order_items") as unknown as {
          select: (query: string) => {
            in: (
              column: string,
              values: string[]
            ) => Promise<{ data: Record<string, unknown>[] | null }>;
          };
        };
        const { data: orderItems } = await orderItemsTable
          .select("*")
          .in("order_id", orderIds);

        orderItemsByOrderId = (orderItems || []).reduce((map, item) => {
          const orderId = String(item.order_id || "");
          if (!orderId) {
            return map;
          }

          const items = map.get(orderId) || [];
          items.push({
            name: asString(item.name) || "Item",
            quantity: Math.max(1, asNumber(item.quantity || 1)),
            price: Number.isFinite(asNumber(item.price)) ? asNumber(item.price) : null,
          });
          map.set(orderId, items);
          return map;
        }, new Map<string, Array<{ name: string; quantity: number; price: number | null }>>());
      } catch {
        orderItemsByOrderId = new Map();
      }
    }

    for (const row of orders || []) {
      const intent =
        intentByOrderId.get(String(row.id || "")) ||
        intentBySessionId.get(String(row.stripe_session_id || ""));
      const metadata = asRecord(intent?.metadata ?? intent?.meta_json);
      const customerSummary = compactCustomerSummary({
        name: asString(row.customer_name) || asString(metadata.customer_name),
        email:
          asString(row.customer_email) ||
          asString(intent?.customer_email) ||
          asString(metadata.customer_email),
        phone:
          asString(row.customer_phone) ||
          asString(row.phone) ||
          asString(intent?.phone) ||
          asString(metadata.customer_phone) ||
          asString(metadata.phone),
      });
      const fulfillmentType =
        titleCaseStatus(asString(row.fulfillment_type)) ||
        titleCaseStatus(asString(metadata.fulfillment_type)) ||
        "Pending";
      const paymentStatus =
        titleCaseStatus(asString(row.payment_status)) || "Pending";
      const orderStatus = titleCaseStatus(asString(row.status)) || "Pending";
      const amount = formatCurrency(asNumber(row.total_amount));
      const items =
        orderItemsByOrderId.get(String(row.id || "")) ||
        asArray(intent?.order_items ?? metadata.order_items).map((item) => {
          const record = asRecord(item);
          return {
            name: asString(record.name) || asString(record.title) || "Item",
            quantity: Math.max(1, asNumber(record.quantity ?? record.qty ?? 1)),
            price:
              record.price === undefined && record.unit_price === undefined && record.amount === undefined
                ? null
                : asNumber(record.price ?? record.unit_price ?? record.amount),
          };
        });
      const address = formatAddress(intent?.address_json ?? metadata.address);

      cards.push({
        id: `order-${row.id}`,
        badge: orderStatus,
        tone: getStatusTone(asString(row.status), asString(row.payment_status)),
        title: buildOrderItemsSummary(items),
        subtitle: "Order details from the source-of-truth order record.",
        amount,
        meta: paymentStatus,
        sections: [
          {
            title: "Who",
            items: customerSummary
              ? [{ label: "Customer", value: customerSummary }]
              : [],
          },
          {
            title: "What",
            items: [
              { label: "Items", value: buildOrderItemsSummary(items) },
            ],
          },
          {
            title: "When",
            items: [
              {
                label: "Placed",
                value:
                  asString(row.created_at)
                    ? new Date(String(row.created_at)).toLocaleString()
                    : "Timestamp pending",
              },
            ],
          },
          {
            title: "Where",
            items: [
              { label: "Method", value: fulfillmentType },
              ...(address ? [{ label: "Address", value: address }] : []),
            ],
          },
          {
            title: "Payment",
            items: [
              ...(amount ? [{ label: "Total", value: amount }] : []),
              { label: "Payment status", value: paymentStatus },
            ],
          },
        ],
      });
    }
  }

  return (
    <AdminPageContainer className="text-[var(--text-main)]">
      <DashboardPrimaryPanel>
        <SectionHeader
          eyebrow="In-app confirmations"
          title="Transactions"
          description={`Completed transaction details for ${business.name}. This view reads from the live booking, reservation, and order records for the active business.`}
        />
        <DashboardGrid className="mt-5 sm:grid-cols-3">
          <StatCard
            label="Business"
            value={business.name}
            detail="Active transaction workspace."
          />
          <StatCard
            label="Module"
            value={businessModule.label}
            detail={businessModule.description}
          />
          <StatCard
            label="Records"
            value={String(cards.length)}
            detail="Visible transaction records."
            tone="success"
          />
        </DashboardGrid>
      </DashboardPrimaryPanel>

      {cards.length === 0 ? (
        <EmptyState
          title="No completed transactions"
          description="Completed transaction details will appear here once bookings, reservations, or orders are available for this business."
        />
      ) : (
        <section className="space-y-4">
          {cards.map((card) => (
            <InAppTransactionCard
              key={card.id}
              badge={card.badge}
              tone={card.tone}
              title={card.title}
              subtitle={card.subtitle}
              amount={card.amount}
              meta={card.meta}
              sections={card.sections}
            />
          ))}
        </section>
      )}
    </AdminPageContainer>
  );
}
