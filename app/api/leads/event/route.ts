import { NextResponse } from "next/server";
import { trackLeadEventServer, trackLeadEventsServer } from "@/lib/leads.server";
import {
  isLeadEventType,
  type LeadEventType,
} from "@/lib/leadTracker";

type LeadEventPayload = {
  businessId?: string;
  eventType?: LeadEventType;
  source?: string;
  conversationId?: string;
  visitor_name?: string;
  visitor_email?: string;
  visitor_phone?: string;
  visitorToken?: string;
  metadata?: Record<string, unknown> | null;
};

type LeadEventBulkPayload = {
  events?: LeadEventPayload[];
};

type RouteError = Error & {
  status?: number;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
};

function normalizeString(value: unknown) {
  const trimmed = String(value || "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function jsonError(
  message: string,
  status: number,
  options?: {
    details?: string | null;
    code?: string | null;
    hint?: string | null;
  }
) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      details: options?.details || null,
      code: options?.code || null,
      hint: options?.hint || null,
    },
    { status }
  );
}

export async function POST(req: Request) {
  try {
    const payload = (await req.json().catch(() => ({}))) as LeadEventPayload | LeadEventBulkPayload;

    if (Array.isArray((payload as LeadEventBulkPayload).events)) {
      const events = ((payload as LeadEventBulkPayload).events || []).map((entry) => ({
        businessId: normalizeString(entry.businessId) || undefined,
        eventType: normalizeString(entry.eventType) as LeadEventType | undefined,
        source: normalizeString(entry.source) || undefined,
        conversationId: normalizeString(entry.conversationId) || undefined,
        visitor_name: normalizeString(entry.visitor_name) || undefined,
        visitor_email: normalizeString(entry.visitor_email) || undefined,
        visitor_phone: normalizeString(entry.visitor_phone) || undefined,
        visitorToken: normalizeString(entry.visitorToken) || undefined,
        metadata: sanitizeMetadata(entry.metadata),
      }));

      if (events.length === 0) {
        return jsonError("Missing events", 400, {
          code: "missing_required_fields",
        });
      }

      const result = await trackLeadEventsServer(events);

      return NextResponse.json({
        ok: true,
        count: result.count || 0,
        visitorToken: result.visitorToken || null,
        visitorTokenSource: result.visitorTokenSource || null,
      });
    }

    const businessId = normalizeString(payload.businessId);
    const eventType = normalizeString(payload.eventType) as LeadEventType | null;
    const source = normalizeString(payload.source);
    const conversationId = normalizeString(payload.conversationId);
    const visitorName = normalizeString(payload.visitor_name);
    const visitorEmail = normalizeString(payload.visitor_email);
    const visitorPhone = normalizeString(payload.visitor_phone);
    const visitorToken = normalizeString(payload.visitorToken);
    const metadata = sanitizeMetadata(payload.metadata);

    console.log("[leads/event] incoming payload", {
      businessId,
      eventType,
      source,
      conversationId,
      visitorToken,
      hasVisitorName: Boolean(visitorName),
      hasVisitorEmail: Boolean(visitorEmail),
      hasVisitorPhone: Boolean(visitorPhone),
      metadataKeys: Object.keys(metadata),
    });

    if (!businessId || !eventType) {
      return jsonError("Missing businessId or eventType", 400, {
        code: "missing_required_fields",
      });
    }

    if (!isLeadEventType(eventType)) {
      return jsonError("Invalid eventType", 400, {
        code: "invalid_event_type",
        details: `Supported types: page_view, business_click, cta_click, message_click, message_sent, booking_started, checkout_started`,
      });
    }

    console.log("[leads/event] sanitized payload", {
      businessId,
      eventType,
      source,
      conversationId,
      visitorToken,
      insertPayload: {
        business_id: businessId,
        event_type: eventType,
        source,
        conversation_id: conversationId,
        visitor_token: visitorToken,
        visitor_name: visitorName,
        visitor_email: visitorEmail,
        visitor_phone: visitorPhone,
        metadata,
      },
    });

    const result = await trackLeadEventServer({
      businessId,
      eventType,
      source,
      conversationId,
      visitor_name: visitorName,
      visitor_email: visitorEmail,
      visitor_phone: visitorPhone,
      metadata,
      visitorToken,
    });

    return NextResponse.json({
      ok: true,
      visitorToken: result?.visitorToken || null,
      visitorTokenSource: result?.visitorTokenSource || null,
    });
  } catch (err: unknown) {
    const error = err as RouteError;
    console.error("[leads/event] failed", {
      message: error?.message || "Unknown lead tracking error",
      details: error?.details || null,
      hint: error?.hint || null,
      code: error?.code || null,
      status: error?.status || 500,
    });

    return jsonError(
      error?.message || "Failed to track lead event",
      error?.status || 500,
      {
        details: error?.details || null,
        code: error?.code || null,
        hint: error?.hint || null,
      }
    );
  }
}
