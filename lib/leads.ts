import { getBusinessModule, isOrderBusinessType, isRentalBusinessType } from "@/lib/businessModules";
import type { Database, Json } from "@/types/database";

export type LeadEventRow = Database["public"]["Tables"]["lead_events"]["Row"];

export type LeadStatus =
  | "new"
  | "reviewed"
  | "contacted"
  | "qualified"
  | "closed";

export const LEAD_STATUS_VALUES: LeadStatus[] = [
  "new",
  "reviewed",
  "contacted",
  "qualified",
  "closed",
];

export type LeadPriority = "urgent" | "high" | "normal";
export type LeadSourceType =
  | "message"
  | "booking"
  | "reservation"
  | "checkout"
  | "page_view"
  | "other";

export type LeadSummaryMetrics = {
  totalGroupedLeads: number;
  newLeads: number;
  uncontactedLeads: number;
  needsFollowUpLeads: number;
  highPriorityLeads: number;
  contactedLeads: number;
  recentLeads: number;
};

export type LeadRecentActivityItem = {
  id: string;
  eventType: string;
  label: string;
  occurredAt: string;
  source: string | null;
  sourceType: LeadSourceType;
  visitorName: string | null;
  visitorEmail: string | null;
  visitorPhone: string | null;
  visitorToken: string | null;
  conversationId: string | null;
  status: string | null;
  notes: string | null;
  lastContactedAt: string | null;
  contextLabel: string;
  actionHref: string | null;
  actionLabel: string | null;
  details: string[];
};

export type LeadVisitorSummary = {
  key: string;
  latestEventId: string;
  latestConversationId: string | null;
  displayName: string;
  visitorName: string | null;
  visitorEmail: string | null;
  visitorPhone: string | null;
  visitorToken: string | null;
  totalEvents: number;
  pageViews: number;
  messageClicks: number;
  messagesSent: number;
  bookingStarts: number;
  checkoutStarts: number;
  firstSeenAt: string;
  lastSeenAt: string;
  latestStatus: string | null;
  latestNotes: string | null;
  lastContactedAt: string | null;
  latestEventType: string;
  latestSource: string | null;
  sourceType: LeadSourceType;
  contextLabel: string;
  summary: string;
  needsFollowUp: boolean;
  uncontacted: boolean;
  highPriority: boolean;
  stale: boolean;
  priority: LeadPriority;
  primaryActionHref: string | null;
  primaryActionLabel: string | null;
  topSources: Array<{ label: string; count: number }>;
  topPages: Array<{ label: string; count: number }>;
};

export type LeadBreakdownItem = {
  label: string;
  count: number;
};

export type LeadDashboardData = {
  events: LeadEventRow[];
  summary: LeadSummaryMetrics;
  recentActivity: LeadRecentActivityItem[];
  visitorSummaries: LeadVisitorSummary[];
  topSources: LeadBreakdownItem[];
  topPages: LeadBreakdownItem[];
  statusBreakdown: LeadBreakdownItem[];
  sourceTypeBreakdown: LeadBreakdownItem[];
};

type BuildLeadDashboardOptions = {
  businessId: string;
  businessType: string | null | undefined;
};

type LeadEventsClient = {
  from: (table: "lead_events") => {
    select: (query: string) => {
      eq: (column: string, value: string) => {
        order: (
          column: string,
          options: { ascending: boolean }
        ) => Promise<{
          data: LeadEventRow[] | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  page_view: "Page viewed",
  business_click: "Business clicked",
  cta_click: "CTA clicked",
  message_click: "Message intent",
  message_sent: "Message sent",
  booking_started: "Booking started",
  checkout_started: "Checkout started",
};

function isObject(value: Json | null | undefined): value is Record<string, Json> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readMetadataValue(
  metadata: Json | null | undefined,
  keys: string[]
): string | null {
  if (!isObject(metadata)) {
    return null;
  }

  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
  }

  return null;
}

function incrementCount(map: Map<string, number>, value: string | null | undefined) {
  const label = String(value || "").trim();
  if (!label) {
    return;
  }

  map.set(label, (map.get(label) || 0) + 1);
}

function toBreakdown(
  map: Map<string, number>,
  limit = 5
): Array<{ label: string; count: number }> {
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function hoursSince(value: string | null | undefined) {
  const timestamp = toTimestamp(value);
  if (!timestamp) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.floor((Date.now() - timestamp) / 3600000);
}

function getEventPage(event: LeadEventRow) {
  return (
    readMetadataValue(event.metadata, ["page", "path", "pathname", "url", "event_value"]) ||
    (event.event_type === "page_view" ? event.source || null : null)
  );
}

function getEventSource(event: LeadEventRow) {
  return (
    event.source ||
    readMetadataValue(event.metadata, ["source", "referrer", "origin"]) ||
    null
  );
}

function getBookingDateLabel(event: LeadEventRow) {
  const date =
    readMetadataValue(event.metadata, ["date", "check_in_date", "start_date"]) || null;
  const startTime =
    readMetadataValue(event.metadata, ["start_time", "startTime"]) || null;

  if (date && startTime) {
    return `${date} at ${startTime}`;
  }

  return date;
}

function getLeadSourceType(
  event: LeadEventRow,
  businessType: string | null | undefined
): LeadSourceType {
  if (event.event_type === "message_click" || event.event_type === "message_sent") {
    return "message";
  }

  if (event.event_type === "business_click" || event.event_type === "cta_click") {
    return "page_view";
  }

  if (event.event_type === "booking_started") {
    return isRentalBusinessType(businessType) ? "reservation" : "booking";
  }

  if (event.event_type === "checkout_started") {
    return "checkout";
  }

  if (event.event_type === "page_view") {
    return "page_view";
  }

  return "other";
}

function getEventContextLabel(
  event: LeadEventRow,
  businessType: string | null | undefined
) {
  const bookingLabel = getBookingDateLabel(event);
  const page = getEventPage(event);
  const fulfillmentType = readMetadataValue(event.metadata, [
    "fulfillmentType",
    "fulfillment_type",
  ]);
  const serviceMode = readMetadataValue(event.metadata, ["serviceMode", "service_mode"]);

  if (event.event_type === "booking_started") {
    if (isRentalBusinessType(businessType)) {
      return bookingLabel
        ? `Reservation request for ${bookingLabel}`
        : "Reservation request started";
    }

    return bookingLabel ? `Booking request for ${bookingLabel}` : "Booking request started";
  }

  if (event.event_type === "checkout_started") {
    if (isOrderBusinessType(businessType)) {
      return fulfillmentType
        ? `Checkout started for ${fulfillmentType}`
        : "Order checkout started";
    }

    return "Checkout started";
  }

  if (event.event_type === "message_sent") {
    return "Lead sent a message";
  }

  if (event.event_type === "message_click") {
    return "Lead opened message entry";
  }

  if (event.event_type === "business_click") {
    return page ? `Clicked business from ${page}` : "Clicked business listing";
  }

  if (event.event_type === "cta_click") {
    const action = readMetadataValue(event.metadata, ["action"]);
    return action ? `CTA clicked: ${action}` : "CTA clicked";
  }

  if (event.event_type === "page_view") {
    return page ? `Viewed ${page}` : "Viewed public page";
  }

  if (serviceMode) {
    return `Service mode ${serviceMode}`;
  }

  return EVENT_TYPE_LABELS[event.event_type] || event.event_type;
}

function buildActivityDetails(event: LeadEventRow) {
  const details: string[] = [];
  const page = getEventPage(event);
  const source = getEventSource(event);
  const eventValue = readMetadataValue(event.metadata, ["event_value", "value"]);
  const fulfillmentType = readMetadataValue(event.metadata, [
    "fulfillmentType",
    "fulfillment_type",
  ]);
  const serviceMode = readMetadataValue(event.metadata, ["serviceMode", "service_mode"]);

  if (page) {
    details.push(`Page: ${page}`);
  }

  if (source && source !== page) {
    details.push(`Source: ${source}`);
  }

  if (fulfillmentType) {
    details.push(`Fulfillment: ${fulfillmentType}`);
  }

  if (serviceMode) {
    details.push(`Mode: ${serviceMode}`);
  }

  if (eventValue && eventValue !== page) {
    details.push(`Value: ${eventValue}`);
  }

  return details;
}

function getVisitorKey(event: LeadEventRow) {
  return (
    event.visitor_token ||
    event.visitor_email ||
    event.visitor_phone ||
    event.conversation_id ||
    event.id
  );
}

function getVisitorDisplayName(event: LeadEventRow) {
  return (
    event.visitor_name ||
    event.visitor_email ||
    event.visitor_phone ||
    (event.visitor_token ? `Visitor ${event.visitor_token.slice(0, 8)}` : "Anonymous visitor")
  );
}

function getPrimaryActionConfig(args: {
  businessId: string;
  businessType: string | null | undefined;
  conversationId: string | null;
  sourceType: LeadSourceType;
}) {
  if (args.conversationId) {
    return {
      href: `/admin/messages?businessId=${encodeURIComponent(
        args.businessId
      )}&conversationId=${encodeURIComponent(args.conversationId)}`,
      label: "Open conversation",
    };
  }

  if (isRentalBusinessType(args.businessType)) {
    return {
      href: "/admin/bookings",
      label: "View reservations",
    };
  }

  if (isOrderBusinessType(args.businessType) || args.sourceType === "checkout") {
    return {
      href: "/admin/orders",
      label: "View orders",
    };
  }

  return {
    href: "/admin/bookings",
    label: "View bookings",
  };
}

function computeVisitorPriority(args: {
  latestStatus: string | null;
  hasConversation: boolean;
  messagesSent: number;
  bookingStarts: number;
  checkoutStarts: number;
  lastSeenAt: string;
  lastContactedAt: string | null;
}) {
  const stale = hoursSince(args.lastSeenAt) >= 72;
  const contactMissing =
    !args.lastContactedAt || toTimestamp(args.lastContactedAt) < toTimestamp(args.lastSeenAt);
  const directIntent =
    args.messagesSent > 0 || args.bookingStarts > 0 || args.checkoutStarts > 0;
  const highPriority =
    args.latestStatus === "qualified" ||
    args.bookingStarts > 0 ||
    args.checkoutStarts > 0 ||
    args.messagesSent > 0;
  const uncontacted =
    contactMissing &&
    args.latestStatus !== "contacted" &&
    args.latestStatus !== "closed";
  const needsFollowUp =
    args.latestStatus !== "closed" &&
    (uncontacted || args.latestStatus === "qualified" || (directIntent && stale));

  let priority: LeadPriority = "normal";
  if (
    args.latestStatus === "qualified" ||
    args.bookingStarts > 0 ||
    args.checkoutStarts > 0
  ) {
    priority = "urgent";
  } else if (args.messagesSent > 0 || args.hasConversation || needsFollowUp) {
    priority = "high";
  }

  return {
    stale,
    uncontacted,
    needsFollowUp,
    highPriority,
    priority,
  };
}

function buildVisitorSummaryLabel(args: {
  businessType: string | null | undefined;
  messagesSent: number;
  bookingStarts: number;
  checkoutStarts: number;
  topSources: Array<{ label: string; count: number }>;
}) {
  if (args.bookingStarts > 0 && isRentalBusinessType(args.businessType)) {
    return "Started a reservation request";
  }

  if (args.bookingStarts > 0) {
    return "Started a booking request";
  }

  if (args.checkoutStarts > 0) {
    return isOrderBusinessType(args.businessType)
      ? "Started an order checkout"
      : "Started checkout";
  }

  if (args.messagesSent > 0) {
    return "Sent a direct message";
  }

  if (args.topSources.length > 0) {
    return `Came from ${args.topSources[0].label}`;
  }

  return "Browsing public pages";
}

export async function fetchLeadEventsForBusiness(
  supabase: LeadEventsClient,
  businessId: string
) {
  const { data, error } = await supabase
    .from("lead_events")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export function computeLeadSummary(
  visitors: LeadVisitorSummary[]
): LeadSummaryMetrics {
  return visitors.reduce<LeadSummaryMetrics>(
    (summary, visitor) => {
      summary.totalGroupedLeads += 1;

      if ((visitor.latestStatus || "new") === "new") {
        summary.newLeads += 1;
      }

      if (visitor.uncontacted) {
        summary.uncontactedLeads += 1;
      }

      if (visitor.needsFollowUp) {
        summary.needsFollowUpLeads += 1;
      }

      if (visitor.highPriority) {
        summary.highPriorityLeads += 1;
      }

      if (!visitor.uncontacted) {
        summary.contactedLeads += 1;
      }

      if (hoursSince(visitor.lastSeenAt) <= 48) {
        summary.recentLeads += 1;
      }

      return summary;
    },
    {
      totalGroupedLeads: 0,
      newLeads: 0,
      uncontactedLeads: 0,
      needsFollowUpLeads: 0,
      highPriorityLeads: 0,
      contactedLeads: 0,
      recentLeads: 0,
    }
  );
}

export function getRecentLeadActivity(
  events: LeadEventRow[],
  options: BuildLeadDashboardOptions,
  limit = 25
): LeadRecentActivityItem[] {
  return [...events]
    .sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at))
    .slice(0, limit)
    .map((event) => {
      const sourceType = getLeadSourceType(event, options.businessType);
      const action = getPrimaryActionConfig({
        businessId: options.businessId,
        businessType: options.businessType,
        conversationId: event.conversation_id || null,
        sourceType,
      });

      return {
        id: event.id,
        eventType: event.event_type,
        label: EVENT_TYPE_LABELS[event.event_type] || event.event_type,
        occurredAt: event.created_at,
        source: getEventSource(event),
        sourceType,
        visitorName: event.visitor_name || null,
        visitorEmail: event.visitor_email || null,
        visitorPhone: event.visitor_phone || null,
        visitorToken: event.visitor_token || null,
        conversationId: event.conversation_id || null,
        status: event.status || null,
        notes: event.notes || null,
        lastContactedAt: event.last_contacted_at || null,
        contextLabel: getEventContextLabel(event, options.businessType),
        actionHref: action.href,
        actionLabel: action.label,
        details: buildActivityDetails(event),
      };
    });
}

export function groupLeadActivityByVisitor(
  events: LeadEventRow[],
  options: BuildLeadDashboardOptions
): LeadVisitorSummary[] {
  const groups = new Map<
    string,
    {
      event: LeadEventRow;
      events: LeadEventRow[];
      sources: Map<string, number>;
      pages: Map<string, number>;
    }
  >();

  for (const event of events) {
    const key = getVisitorKey(event);
    const existing = groups.get(key);

    if (existing) {
      existing.events.push(event);
      incrementCount(existing.sources, getEventSource(event));
      incrementCount(existing.pages, getEventPage(event));
      continue;
    }

    const sources = new Map<string, number>();
    const pages = new Map<string, number>();
    incrementCount(sources, getEventSource(event));
    incrementCount(pages, getEventPage(event));

    groups.set(key, {
      event,
      events: [event],
      sources,
      pages,
    });
  }

  return [...groups.values()]
    .map((group) => {
      const sortedEvents = [...group.events].sort(
        (a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at)
      );
      const latest = sortedEvents[0];
      const oldest = sortedEvents[sortedEvents.length - 1];
      const messagesSent = group.events.filter((event) => event.event_type === "message_sent").length;
      const messageClicks = group.events.filter((event) => event.event_type === "message_click").length;
      const bookingStarts = group.events.filter((event) => event.event_type === "booking_started").length;
      const checkoutStarts = group.events.filter((event) => event.event_type === "checkout_started").length;
      const pageViews = group.events.filter((event) => event.event_type === "page_view").length;
      const sourceType = getLeadSourceType(latest, options.businessType);
      const topSources = toBreakdown(group.sources, 3);
      const topPages = toBreakdown(group.pages, 3);
      const priorityState = computeVisitorPriority({
        latestStatus: latest.status || null,
        hasConversation: Boolean(latest.conversation_id),
        messagesSent,
        bookingStarts,
        checkoutStarts,
        lastSeenAt: latest.created_at,
        lastContactedAt: latest.last_contacted_at || null,
      });
      const action = getPrimaryActionConfig({
        businessId: options.businessId,
        businessType: options.businessType,
        conversationId: latest.conversation_id || null,
        sourceType,
      });

      return {
        key: getVisitorKey(group.event),
        latestEventId: latest.id,
        latestConversationId: latest.conversation_id || null,
        displayName: getVisitorDisplayName(latest),
        visitorName: latest.visitor_name || group.event.visitor_name || null,
        visitorEmail: latest.visitor_email || group.event.visitor_email || null,
        visitorPhone: latest.visitor_phone || group.event.visitor_phone || null,
        visitorToken: latest.visitor_token || group.event.visitor_token || null,
        totalEvents: group.events.length,
        pageViews,
        messageClicks,
        messagesSent,
        bookingStarts,
        checkoutStarts,
        firstSeenAt: oldest.created_at,
        lastSeenAt: latest.created_at,
        latestStatus: latest.status || null,
        latestNotes: latest.notes || null,
        lastContactedAt: latest.last_contacted_at || null,
        latestEventType: latest.event_type,
        latestSource: getEventSource(latest),
        sourceType,
        contextLabel: getEventContextLabel(latest, options.businessType),
        summary: buildVisitorSummaryLabel({
          businessType: options.businessType,
          messagesSent,
          bookingStarts,
          checkoutStarts,
          topSources,
        }),
        needsFollowUp: priorityState.needsFollowUp,
        uncontacted: priorityState.uncontacted,
        highPriority: priorityState.highPriority,
        stale: priorityState.stale,
        priority: priorityState.priority,
        primaryActionHref: action.href,
        primaryActionLabel: action.label,
        topSources,
        topPages,
      };
    })
    .sort((a, b) => {
      const priorityRank: Record<LeadPriority, number> = {
        urgent: 3,
        high: 2,
        normal: 1,
      };
      return (
        priorityRank[b.priority] - priorityRank[a.priority] ||
        toTimestamp(b.lastSeenAt) - toTimestamp(a.lastSeenAt)
      );
    });
}

export function getTopLeadSources(
  events: LeadEventRow[],
  limit = 5
): LeadBreakdownItem[] {
  const counts = new Map<string, number>();

  for (const event of events) {
    incrementCount(counts, getEventSource(event));
  }

  return toBreakdown(counts, limit);
}

export function getTopLeadPages(
  events: LeadEventRow[],
  limit = 5
): LeadBreakdownItem[] {
  const counts = new Map<string, number>();

  for (const event of events) {
    incrementCount(counts, getEventPage(event));
  }

  return toBreakdown(counts, limit);
}

export function getLeadStatusBreakdown(
  visitors: LeadVisitorSummary[],
  limit = 5
): LeadBreakdownItem[] {
  const counts = new Map<string, number>();

  for (const visitor of visitors) {
    incrementCount(counts, visitor.latestStatus || "new");
  }

  return toBreakdown(counts, limit);
}

export function getLeadSourceTypeBreakdown(
  visitors: LeadVisitorSummary[],
  limit = 5
): LeadBreakdownItem[] {
  const counts = new Map<string, number>();

  for (const visitor of visitors) {
    incrementCount(counts, visitor.sourceType);
  }

  return toBreakdown(counts, limit);
}

export function getLeadEmptyStateSuggestions(businessType: string | null | undefined) {
  const businessModule = getBusinessModule(businessType);

  if (isRentalBusinessType(businessType)) {
    return [
      "Enable guest messaging on your public listing pages.",
      "Keep availability current so reservation-start signals stay accurate.",
      `Review ${businessModule.primaryAdminLabel.toLowerCase()} setup to drive inquiry traffic.`,
    ];
  }

  if (isOrderBusinessType(businessType)) {
    return [
      "Promote direct ordering links from your public storefront.",
      "Use guest messaging to capture pre-purchase questions.",
      `Keep ${businessModule.primaryAdminLabel.toLowerCase()} published so checkout starts can be tracked.`,
    ];
  }

  return [
    "Promote your booking page and public messaging entry points.",
    "Keep service offerings published so booking-start signals can be captured.",
    "Respond quickly to new conversations so follow-up momentum stays high.",
  ];
}

export function buildLeadDashboardData(
  events: LeadEventRow[],
  options: BuildLeadDashboardOptions
): LeadDashboardData {
  const visitorSummaries = groupLeadActivityByVisitor(events, options);

  return {
    events,
    summary: computeLeadSummary(visitorSummaries),
    recentActivity: getRecentLeadActivity(events, options),
    visitorSummaries,
    topSources: getTopLeadSources(events),
    topPages: getTopLeadPages(events),
    statusBreakdown: getLeadStatusBreakdown(visitorSummaries),
    sourceTypeBreakdown: getLeadSourceTypeBreakdown(visitorSummaries),
  };
}
