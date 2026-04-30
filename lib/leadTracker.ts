export type LeadEventType =
  | "page_view"
  | "business_click"
  | "cta_click"
  | "message_click"
  | "message_sent"
  | "booking_started"
  | "checkout_started";

const LEAD_EVENT_TYPES: LeadEventType[] = [
  "page_view",
  "business_click",
  "cta_click",
  "message_click",
  "message_sent",
  "booking_started",
  "checkout_started",
];

export type LeadEventArgs = {
  businessId: string;
  eventType: LeadEventType;
  source?: string | null;
  conversationId?: string | null;
  visitor_name?: string | null;
  visitor_email?: string | null;
  visitor_phone?: string | null;
  metadata?: Record<string, unknown> | null;
  visitorToken?: string | null;
};

export type LeadTrackingResult = {
  ok: boolean;
  visitorToken?: string | null;
  error?: string;
  details?: string | null;
  code?: string | null;
};

export type BulkLeadTrackingResult = LeadTrackingResult & {
  count?: number;
};

const VISITOR_TOKEN_COOKIE = "sn_visitor_token";

export function isLeadEventType(value: unknown): value is LeadEventType {
  return (
    typeof value === "string" &&
    LEAD_EVENT_TYPES.includes(value as LeadEventType)
  );
}

function normalizeString(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function createVisitorToken() {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getClientCookie(name: string) {
  if (typeof document === "undefined") {
    return null;
  }

  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

function getOrCreateClientVisitorToken() {
  const existing = getClientCookie(VISITOR_TOKEN_COOKIE);

  if (existing) {
    return existing;
  }

  const token = createVisitorToken();
  document.cookie = `${VISITOR_TOKEN_COOKIE}=${encodeURIComponent(
    token
  )}; Path=/; Max-Age=31536000; SameSite=Lax`;
  return token;
}

export async function trackLeadEvent(args: LeadEventArgs) {
  const visitorToken =
    normalizeString(args.visitorToken) ||
    (typeof window !== "undefined" ? getOrCreateClientVisitorToken() : null);

  const payload = {
    businessId: normalizeString(args.businessId),
    eventType: args.eventType,
    source: normalizeString(args.source),
    conversationId: normalizeString(args.conversationId),
    visitor_name: normalizeString(args.visitor_name),
    visitor_email: normalizeString(args.visitor_email),
    visitor_phone: normalizeString(args.visitor_phone),
    metadata:
      args.metadata && typeof args.metadata === "object" && !Array.isArray(args.metadata)
        ? args.metadata
        : {},
    visitorToken,
  };

  try {
    const response = await fetch("/api/leads/event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorPayload =
        data && typeof data === "object"
          ? (data as {
              error?: string;
              details?: string | null;
              code?: string | null;
            })
          : null;

      console.error("[leadTracker] API request failed", {
        status: response.status,
        statusText: response.statusText,
        payload,
        response: data,
      });

      return {
        ok: false,
        visitorToken,
        error: errorPayload?.error || "Lead tracking failed",
        details: errorPayload?.details || null,
        code: errorPayload?.code || null,
      } satisfies LeadTrackingResult;
    }

    return (data || { ok: true, visitorToken }) as LeadTrackingResult;
  } catch (error) {
    console.error("[leadTracker] request error", {
      payload,
      message: error instanceof Error ? error.message : "Unknown lead tracking error",
    });

    return {
      ok: false,
      visitorToken,
      error: error instanceof Error ? error.message : "Lead tracking request failed",
      details: null,
      code: null,
    } satisfies LeadTrackingResult;
  }
}

export async function trackLeadEvents(args: LeadEventArgs[]) {
  const visitorToken =
    typeof window !== "undefined" ? getOrCreateClientVisitorToken() : null;

  const payload = {
    events: args
      .map((entry) => ({
        businessId: normalizeString(entry.businessId),
        eventType: entry.eventType,
        source: normalizeString(entry.source),
        conversationId: normalizeString(entry.conversationId),
        visitor_name: normalizeString(entry.visitor_name),
        visitor_email: normalizeString(entry.visitor_email),
        visitor_phone: normalizeString(entry.visitor_phone),
        metadata:
          entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata)
            ? entry.metadata
            : {},
        visitorToken: normalizeString(entry.visitorToken) || visitorToken,
      }))
      .filter((entry) => entry.businessId && entry.eventType),
  };

  if (payload.events.length === 0) {
    return {
      ok: true,
      visitorToken,
      count: 0,
    } satisfies BulkLeadTrackingResult;
  }

  try {
    const response = await fetch("/api/leads/event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorPayload =
        data && typeof data === "object"
          ? (data as {
              error?: string;
              details?: string | null;
              code?: string | null;
            })
          : null;

      if (process.env.NODE_ENV !== "production") {
        console.error("[leadTracker] bulk API request failed", {
          status: response.status,
          statusText: response.statusText,
          payload,
          response: data,
        });
      }

      return {
        ok: false,
        visitorToken,
        error: errorPayload?.error || "Lead tracking failed",
        details: errorPayload?.details || null,
        code: errorPayload?.code || null,
      } satisfies BulkLeadTrackingResult;
    }

    return (data || {
      ok: true,
      visitorToken,
      count: payload.events.length,
    }) as BulkLeadTrackingResult;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[leadTracker] bulk request error", {
        payload,
        message: error instanceof Error ? error.message : "Unknown lead tracking error",
      });
    }

    return {
      ok: false,
      visitorToken,
      error: error instanceof Error ? error.message : "Lead tracking request failed",
      details: null,
      code: null,
    } satisfies BulkLeadTrackingResult;
  }
}
