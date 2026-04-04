import {
  getAdminNav,
  getBusinessModule,
  isOrderBusinessType,
  isRentalBusinessType,
} from "@/lib/businessModules";
import { formatReservationRange } from "@/lib/rentalAvailability";
import type { Database } from "@/types/database";

type BusinessRow = Database["public"]["Tables"]["businesses"]["Row"];
type ConversationRow = Pick<
  Database["public"]["Tables"]["conversations"]["Row"],
  "id" | "business_id" | "client_name" | "client_email" | "last_message_at" | "updated_at" | "context_type"
>;
type LeadEventRow = Pick<
  Database["public"]["Tables"]["lead_events"]["Row"],
  "id" | "business_id" | "event_type" | "created_at"
>;
type ServiceBookingRow = Pick<
  Database["public"]["Tables"]["bookings"]["Row"],
  | "id"
  | "business_id"
  | "guest_name"
  | "guest_email"
  | "customer_name"
  | "customer_email"
  | "status"
  | "payment_status"
  | "amount_total"
  | "total_amount"
  | "date"
  | "start_time"
  | "end_time"
  | "created_at"
>;
type RentalReservationRow = Pick<
  Database["public"]["Tables"]["rental_reservations"]["Row"],
  | "id"
  | "business_id"
  | "property_id"
  | "guest_name"
  | "guest_email"
  | "status"
  | "payment_status"
  | "amount_total"
  | "check_in_date"
  | "check_out_date"
  | "created_at"
>;
type BlockRow = Pick<
  Database["public"]["Tables"]["rental_availability_blocks"]["Row"],
  "id" | "business_id" | "property_id" | "start_date" | "end_date" | "reason" | "created_at"
>;
type PropertyRow = Pick<
  Database["public"]["Tables"]["property"]["Row"],
  "id" | "business_id" | "name" | "price"
>;

type ProductRow = {
  id: string;
  business_id: string;
  name: string | null;
  price: number | null;
  created_at?: string | null;
};

type OrderRow = {
  id: string;
  business_id: string;
  customer_name?: string | null;
  customer_email?: string | null;
  status?: string | null;
  payment_status?: string | null;
  total_amount?: number | null;
  created_at?: string | null;
  fulfillment_type?: string | null;
};

type ServiceRow = {
  id: string;
  business_id: string;
  name: string | null;
  price: number | null;
  duration: number | null;
  created_at?: string | null;
};

type QueryResult = Promise<{ data: unknown[] | null }>;
type FilterQuery = {
  eq: (column: string, value: string) => FilterQuery;
  order: (column: string, options: { ascending: boolean }) => QueryResult;
};
type DashboardSupabaseClient = {
  from: (table: string) => {
    select: (query: string) => FilterQuery;
  };
};

export type DashboardMetricTone = "default" | "success" | "alert" | "accent";

export type DashboardMetric = {
  label: string;
  value: string;
  detail: string;
  tone: DashboardMetricTone;
};

export type DashboardActivityItem = {
  id: string;
  kind: "booking" | "order" | "reservation" | "message" | "lead" | "block";
  title: string;
  detail: string;
  timestamp: string | null;
  status: string | null;
  href: string | null;
};

export type DashboardQuickAction = {
  label: string;
  href: string;
};

export type DashboardEmptyState = {
  title: string;
  description: string;
  actions: DashboardQuickAction[];
};

export type DashboardData = {
  businessType: string;
  businessLabel: string;
  heroTitle: string;
  heroDescription: string;
  quickActions: DashboardQuickAction[];
  metrics: DashboardMetric[];
  recentActivity: DashboardActivityItem[];
  activityTitle: string;
  activityDescription: string;
  emptyState: DashboardEmptyState | null;
  notes: string[];
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function getDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function toSentenceCase(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  return value.replace(/_/g, " ");
}

function formatServiceWindow(date: string | null, startTime: string | null, endTime: string | null) {
  if (!date) {
    return "Date pending";
  }

  if (!startTime && !endTime) {
    return date;
  }

  return `${date} ${startTime || "--:--"}${endTime ? ` - ${endTime}` : ""}`;
}

function getConversationLabel(conversation: ConversationRow) {
  return conversation.client_name || conversation.client_email || "Conversation";
}

function getOrderStatus(order: OrderRow) {
  if (order.status === "completed" || order.status === "fulfilled") {
    return "fulfilled";
  }

  if (order.status === "canceled" || order.status === "cancelled") {
    return "cancelled";
  }

  if (order.status === "received" && order.payment_status === "paid") {
    return "pending";
  }

  return order.status || order.payment_status || "pending";
}

function getServiceBookingAmount(booking: ServiceBookingRow) {
  const cents = Number(booking.amount_total ?? booking.total_amount ?? 0);
  return cents / 100;
}

function getRentalAmount(reservation: RentalReservationRow) {
  return Number(reservation.amount_total || 0) / 100;
}

function hasServiceBookingRevenue(booking: ServiceBookingRow) {
  return booking.payment_status === "paid" || booking.status === "confirmed";
}

function hasRentalRevenue(reservation: RentalReservationRow) {
  return reservation.payment_status === "paid" || reservation.status === "confirmed";
}

function createQuickActions(business: BusinessRow) {
  return getAdminNav(business.business_type, business.plan)
    .filter((item) => item.href !== "/admin/dashboard" && item.href !== "/admin/settings")
    .filter((item) => item.href !== "/admin/upgrade" && item.href !== "/admin/platform")
    .slice(0, 4);
}

function sortActivity(items: DashboardActivityItem[]) {
  return [...items]
    .sort(
      (a, b) =>
        new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
    )
    .slice(0, 8);
}

function buildServiceDashboard(params: {
  business: BusinessRow;
  services: ServiceRow[];
  bookings: ServiceBookingRow[];
  conversations: ConversationRow[];
  leadEvents: LeadEventRow[];
}): DashboardData {
  const { business, services, bookings, conversations, leadEvents } = params;
  const today = getDateKey();
  const todaysBookings = bookings.filter((booking) => booking.date === today);
  const pendingBookings = bookings.filter((booking) => booking.status === "pending");
  const upcomingAppointments = bookings.filter((booking) => {
    if (!booking.date) return false;
    return booking.date >= today && booking.status !== "cancelled";
  });
  const revenue = bookings
    .filter(hasServiceBookingRevenue)
    .reduce((sum, booking) => sum + getServiceBookingAmount(booking), 0);

  const recentActivity = sortActivity([
    ...bookings.map((booking) => ({
      id: `booking-${booking.id}`,
      kind: "booking" as const,
      title:
        booking.customer_name ||
        booking.guest_name ||
        booking.customer_email ||
        booking.guest_email ||
        "Booking",
      detail: `Service booking for ${formatServiceWindow(
        booking.date,
        booking.start_time,
        booking.end_time
      )}`,
      timestamp: booking.created_at || booking.date,
      status: booking.status || booking.payment_status || "pending",
      href: "/admin/bookings",
    })),
    ...conversations.map((conversation) => ({
      id: `message-${conversation.id}`,
      kind: "message" as const,
      title: getConversationLabel(conversation),
      detail: "Recent client conversation",
      timestamp: conversation.last_message_at || conversation.updated_at,
      status: conversation.context_type || "message",
      href: `/admin/messages?conversation=${encodeURIComponent(conversation.id)}`,
    })),
    ...leadEvents.map((event) => ({
      id: `lead-${event.id}`,
      kind: "lead" as const,
      title: toSentenceCase(event.event_type),
      detail: "Lead capture activity",
      timestamp: event.created_at,
      status: event.event_type,
      href: "/admin/leads",
    })),
  ]);

  const noActivity =
    services.length === 0 && bookings.length === 0 && conversations.length === 0;

  return {
    businessType: business.business_type || "service",
    businessLabel: getBusinessModule(business.business_type).label,
    heroTitle: "Service dashboard",
    heroDescription:
      "Track bookings, appointment load, client conversations, and revenue for the active service business.",
    quickActions: createQuickActions(business),
    metrics: [
      {
        label: "Bookings today",
        value: String(todaysBookings.length),
        detail: `Scheduled on ${today}.`,
        tone: todaysBookings.length > 0 ? "success" : "default",
      },
      {
        label: "Pending bookings",
        value: String(pendingBookings.length),
        detail: "Awaiting confirmation or follow-up.",
        tone: pendingBookings.length > 0 ? "alert" : "default",
      },
      {
        label: "Upcoming appointments",
        value: String(upcomingAppointments.length),
        detail: "Future bookings on the calendar.",
        tone: "default",
      },
      {
        label: "Active conversations",
        value: String(conversations.length),
        detail: "Business-scoped message threads.",
        tone: conversations.length > 0 ? "accent" : "default",
      },
      {
        label: "Revenue",
        value: formatCurrency(revenue),
        detail: "Paid or confirmed service bookings.",
        tone: revenue > 0 ? "success" : "default",
      },
      {
        label: "Published services",
        value: String(services.length),
        detail: "Owner-created offerings available to customers.",
        tone: "default",
      },
    ],
    recentActivity,
    activityTitle: "Recent activity",
    activityDescription: "Latest bookings, conversations, and lead signals for this service business.",
    emptyState: noActivity
      ? {
          title: "No service activity yet",
          description:
            services.length === 0
              ? "Create your first service so customers have something real to book."
              : "Your services are live, but no bookings or conversations have landed yet.",
          actions: [
            { label: services.length === 0 ? "Add services" : "Review services", href: "/admin/services" },
            { label: "Open bookings", href: "/admin/bookings" },
            { label: "Check messages", href: "/admin/messages" },
          ],
        }
      : null,
    notes: [],
  };
}

function buildOrderDashboard(params: {
  business: BusinessRow;
  products: ProductRow[];
  orders: OrderRow[];
  conversations: ConversationRow[];
}): DashboardData {
  const { business, products, orders, conversations } = params;
  const today = getDateKey();
  const todaysOrders = orders.filter((order) => (order.created_at || "").slice(0, 10) === today);
  const pendingOrders = orders.filter((order) => {
    const status = getOrderStatus(order);
    return status !== "fulfilled" && status !== "completed" && status !== "cancelled";
  });
  const revenue = orders
    .filter((order) => order.payment_status === "paid" || order.status === "completed" || order.status === "fulfilled")
    .reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const uniqueCustomers = new Set(
    orders.map((order) => order.customer_email || order.customer_name).filter(Boolean)
  ).size;

  const recentActivity = sortActivity([
    ...orders.map((order) => ({
      id: `order-${order.id}`,
      kind: "order" as const,
      title: order.customer_name || order.customer_email || "Order",
      detail: `${order.fulfillment_type || "Order"} order`,
      timestamp: order.created_at || null,
      status: getOrderStatus(order),
      href: "/admin/orders",
    })),
    ...conversations.map((conversation) => ({
      id: `message-${conversation.id}`,
      kind: "message" as const,
      title: getConversationLabel(conversation),
      detail: "Recent client conversation",
      timestamp: conversation.last_message_at || conversation.updated_at,
      status: conversation.context_type || "message",
      href: `/admin/messages?conversation=${encodeURIComponent(conversation.id)}`,
    })),
  ]);

  const moduleLabel =
    business.business_type === "restaurant" || business.business_type === "food"
      ? "menu"
      : "catalog";
  const noActivity = products.length === 0 && orders.length === 0 && conversations.length === 0;

  return {
    businessType: business.business_type || "store",
    businessLabel: getBusinessModule(business.business_type).label,
    heroTitle:
      business.business_type === "restaurant" || business.business_type === "food"
        ? "Order dashboard"
        : "Commerce dashboard",
    heroDescription:
      business.business_type === "restaurant" || business.business_type === "food"
        ? "Monitor order volume, queue pressure, customer conversations, and daily revenue."
        : "Monitor product orders, customer conversations, and revenue across the active storefront.",
    quickActions: createQuickActions(business),
    metrics: [
      {
        label: "Orders today",
        value: String(todaysOrders.length),
        detail: `Placed on ${today}.`,
        tone: todaysOrders.length > 0 ? "success" : "default",
      },
      {
        label: "Pending orders",
        value: String(pendingOrders.length),
        detail: "Still in the fulfillment queue.",
        tone: pendingOrders.length > 0 ? "alert" : "default",
      },
      {
        label: business.business_type === "restaurant" || business.business_type === "food" ? "Menu items" : "Products",
        value: String(products.length),
        detail: `Owner-created ${moduleLabel} records available for sale.`,
        tone: "default",
      },
      {
        label: "Active conversations",
        value: String(conversations.length),
        detail: "Business-scoped client threads.",
        tone: conversations.length > 0 ? "accent" : "default",
      },
      {
        label: "Revenue",
        value: formatCurrency(revenue),
        detail: "Paid or fulfilled orders.",
        tone: revenue > 0 ? "success" : "default",
      },
      {
        label: "Recent customers",
        value: String(uniqueCustomers),
        detail: "Distinct customers with order activity.",
        tone: "default",
      },
    ],
    recentActivity,
    activityTitle: "Recent activity",
    activityDescription:
      "Latest order flow and customer conversations for the active order-based business.",
    emptyState: noActivity
      ? {
          title: "No order activity yet",
          description:
            products.length === 0
              ? `Add your first ${moduleLabel} item so customers can place real orders.`
              : "Your catalog is in place, but no orders or conversations have landed yet.",
          actions: [
            {
              label:
                business.business_type === "restaurant" || business.business_type === "food"
                  ? "Manage menu"
                  : "Manage products",
              href: "/admin/products",
            },
            { label: "Open orders", href: "/admin/orders" },
            { label: "Check messages", href: "/admin/messages" },
          ],
        }
      : null,
    notes: [],
  };
}

function buildRentalDashboard(params: {
  business: BusinessRow;
  properties: PropertyRow[];
  reservations: RentalReservationRow[];
  blocks: BlockRow[];
  conversations: ConversationRow[];
  leadEvents: LeadEventRow[];
}): DashboardData {
  const { business, properties, reservations, blocks, conversations, leadEvents } = params;
  const today = getDateKey();
  const upcomingReservations = reservations.filter((reservation) => {
    return reservation.check_in_date >= today && reservation.status !== "cancelled";
  });
  const pendingReservations = reservations.filter((reservation) => {
    return (
      reservation.status !== "confirmed" &&
      reservation.status !== "cancelled" &&
      reservation.payment_status !== "paid"
    );
  });
  const revenue = reservations
    .filter(hasRentalRevenue)
    .reduce((sum, reservation) => sum + getRentalAmount(reservation), 0);

  const recentActivity = sortActivity([
    ...reservations.map((reservation) => ({
      id: `reservation-${reservation.id}`,
      kind: "reservation" as const,
      title: reservation.guest_name || reservation.guest_email || "Reservation",
      detail: formatReservationRange(
        reservation.check_in_date,
        reservation.check_out_date
      ),
      timestamp: reservation.created_at || reservation.check_in_date,
      status: reservation.status || reservation.payment_status || "pending",
      href: "/admin/bookings",
    })),
    ...blocks.map((block) => ({
      id: `block-${block.id}`,
      kind: "block" as const,
      title: "Blocked dates",
      detail: `${formatReservationRange(block.start_date, block.end_date)}${block.reason ? ` - ${block.reason}` : ""}`,
      timestamp: block.created_at || block.start_date,
      status: "blocked",
      href: "/admin/rentals",
    })),
    ...conversations.map((conversation) => ({
      id: `message-${conversation.id}`,
      kind: "message" as const,
      title: getConversationLabel(conversation),
      detail: "Recent guest conversation",
      timestamp: conversation.last_message_at || conversation.updated_at,
      status: conversation.context_type || "message",
      href: `/admin/messages?conversation=${encodeURIComponent(conversation.id)}`,
    })),
    ...leadEvents.map((event) => ({
      id: `lead-${event.id}`,
      kind: "lead" as const,
      title: toSentenceCase(event.event_type),
      detail: "Lead capture activity",
      timestamp: event.created_at,
      status: event.event_type,
      href: "/admin/leads",
    })),
  ]);

  const noActivity =
    properties.length === 0 &&
    reservations.length === 0 &&
    blocks.length === 0 &&
    conversations.length === 0;

  return {
    businessType: business.business_type || "rental",
    businessLabel: getBusinessModule(business.business_type).label,
    heroTitle: "Rental dashboard",
    heroDescription:
      "Monitor listing inventory, upcoming stays, blocked dates, guest conversations, and reservation revenue.",
    quickActions: createQuickActions(business),
    metrics: [
      {
        label: business.business_type === "property" ? "Listings" : "Inventory items",
        value: String(properties.length),
        detail: "Owner-created rental records in this business.",
        tone: "default",
      },
      {
        label: "Upcoming stays",
        value: String(upcomingReservations.length),
        detail: "Future reservations on the books.",
        tone: upcomingReservations.length > 0 ? "success" : "default",
      },
      {
        label: "Pending reservations",
        value: String(pendingReservations.length),
        detail: "Reservations still awaiting operational action.",
        tone: pendingReservations.length > 0 ? "alert" : "default",
      },
      {
        label: "Blocked dates",
        value: String(blocks.length),
        detail: "Availability windows currently blocked.",
        tone: "default",
      },
      {
        label: "Guest conversations",
        value: String(conversations.length),
        detail: "Business-scoped guest messaging threads.",
        tone: conversations.length > 0 ? "accent" : "default",
      },
      {
        label: "Revenue",
        value: formatCurrency(revenue),
        detail: "Paid or confirmed reservations.",
        tone: revenue > 0 ? "success" : "default",
      },
    ],
    recentActivity,
    activityTitle: "Recent activity",
    activityDescription:
      "Latest reservations, blocked availability windows, conversations, and lead signals for this rental business.",
    emptyState: noActivity
      ? {
          title: "No rental activity yet",
          description:
            properties.length === 0
              ? "Create your first listing so guests can browse and reserve real inventory."
              : "Your listings exist, but no reservations or guest conversations have landed yet.",
          actions: [
            { label: business.business_type === "property" ? "Manage listings" : "Manage inventory", href: "/admin/rentals" },
            { label: "Open reservations", href: "/admin/bookings" },
            { label: "Check messages", href: "/admin/messages" },
          ],
        }
      : null,
    notes: [],
  };
}

export async function buildDashboardData(params: {
  supabase: DashboardSupabaseClient;
  business: BusinessRow;
}): Promise<DashboardData> {
  const { supabase, business } = params;
  const businessModule = getBusinessModule(business.business_type);
  const businessId = business.id;

  const commonPromises = await Promise.all([
    supabase
      .from("conversations")
      .select("id, business_id, client_name, client_email, last_message_at, updated_at, context_type")
      .eq("business_id", businessId)
      .order("updated_at", { ascending: false }),
    businessModule.leadsEnabled
      ? supabase
          .from("lead_events")
          .select("id, business_id, event_type, created_at")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as LeadEventRow[] }),
  ]);

  const conversations = (commonPromises[0].data || []) as ConversationRow[];
  const leadEvents = (commonPromises[1].data || []) as LeadEventRow[];

  if (isRentalBusinessType(business.business_type)) {
    const [{ data: properties }, { data: reservations }, { data: blocks }] = await Promise.all([
      supabase
        .from("property")
        .select("id, business_id, name, price")
        .eq("business_id", businessId)
        .order("name", { ascending: true }),
      supabase
        .from("rental_reservations")
        .select("id, business_id, property_id, guest_name, guest_email, status, payment_status, amount_total, check_in_date, check_out_date, created_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false }),
      supabase
        .from("rental_availability_blocks")
        .select("id, business_id, property_id, start_date, end_date, reason, created_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false }),
    ]);

    console.log("[admin/dashboard] source records", {
      businessId,
      businessType: business.business_type || null,
      sourceTable: "rental_reservations/property/rental_availability_blocks/conversations/lead_events",
      reservationCount: reservations?.length || 0,
      propertyCount: properties?.length || 0,
      blockCount: blocks?.length || 0,
      conversationCount: conversations.length,
      leadEventCount: leadEvents.length,
    });

    return buildRentalDashboard({
      business,
      properties: (properties || []) as PropertyRow[],
      reservations: (reservations || []) as RentalReservationRow[],
      blocks: (blocks || []) as BlockRow[],
      conversations,
      leadEvents,
    });
  }

  if (isOrderBusinessType(business.business_type)) {
    const ordersTable = supabase.from("orders");
    const productsTable = supabase.from("products");
    const [{ data: orders }, { data: products }] = await Promise.all([
      ordersTable
        .select("id, business_id, customer_name, customer_email, status, payment_status, total_amount, created_at, fulfillment_type")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false }),
      productsTable
        .select("id, business_id, name, price, created_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false }),
    ]);

    console.log("[admin/dashboard] source records", {
      businessId,
      businessType: business.business_type || null,
      sourceTable: "orders/products/conversations",
      orderCount: orders?.length || 0,
      productCount: products?.length || 0,
      conversationCount: conversations.length,
    });

    return buildOrderDashboard({
      business,
      orders: (orders || []) as OrderRow[],
      products: (products || []) as ProductRow[],
      conversations,
    });
  }

  const servicesTable = supabase.from("services");
  const [{ data: services }, { data: bookings }] = await Promise.all([
    servicesTable
      .select("id, business_id, name, price, duration, created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false }),
    supabase
      .from("bookings")
      .select("id, business_id, guest_name, guest_email, customer_name, customer_email, status, payment_status, amount_total, total_amount, date, start_time, end_time, created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false }),
  ]);

  console.log("[admin/dashboard] source records", {
    businessId,
    businessType: business.business_type || null,
    sourceTable: "bookings/services/conversations/lead_events",
    bookingCount: bookings?.length || 0,
    serviceCount: services?.length || 0,
    conversationCount: conversations.length,
    leadEventCount: leadEvents.length,
  });

  return buildServiceDashboard({
    business,
    services: (services || []) as ServiceRow[],
    bookings: (bookings || []) as ServiceBookingRow[],
    conversations,
    leadEvents,
  });
}
