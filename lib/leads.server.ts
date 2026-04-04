import "server-only";

import { cookies } from "next/headers";
import type { LeadEventArgs } from "@/lib/leadTracker";
import { isLeadEventType } from "@/lib/leadTracker";
import { createAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

const VISITOR_TOKEN_COOKIE = "sn_visitor_token";

type LeadEventInsert = Database["public"]["Tables"]["lead_events"]["Insert"];

type LeadTrackingServerError = Error & {
  status?: number;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
};

function normalizeString(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeMetadata(value: LeadEventArgs["metadata"]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value;
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

async function getOrCreateServerVisitorToken() {
  const cookieStore = await cookies();
  const existing = cookieStore.get(VISITOR_TOKEN_COOKIE)?.value || null;

  if (existing) {
    return existing;
  }

  const token = createVisitorToken();
  cookieStore.set(VISITOR_TOKEN_COOKIE, token, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return token;
}

function createLeadTrackingError(
  message: string,
  options?: {
    status?: number;
    code?: string | null;
    details?: string | null;
    hint?: string | null;
  }
) {
  const error = new Error(message) as LeadTrackingServerError;
  error.status = options?.status;
  error.code = options?.code || null;
  error.details = options?.details || null;
  error.hint = options?.hint || null;
  return error;
}

export async function trackLeadEventServer(args: LeadEventArgs) {
  const businessId = normalizeString(args.businessId);
  const eventType = normalizeString(args.eventType);

  if (!businessId || !eventType) {
    throw createLeadTrackingError("Missing businessId or eventType", {
      status: 400,
      code: "missing_required_fields",
    });
  }

  if (!isLeadEventType(eventType)) {
    throw createLeadTrackingError("Invalid eventType", {
      status: 400,
      code: "invalid_event_type",
    });
  }

  const supabase = createAdminClient();
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .maybeSingle();

  if (businessError) {
    throw createLeadTrackingError("Failed to verify business", {
      status: 500,
      code: businessError.code,
      details: businessError.details,
      hint: businessError.hint,
    });
  }

  if (!business?.id) {
    throw createLeadTrackingError("Business not found", {
      status: 404,
      code: "business_not_found",
    });
  }

  let visitorToken = normalizeString(args.visitorToken);
  let visitorTokenSource: "request" | "cookie" | "generated" | "unavailable" = "request";

  if (!visitorToken) {
    try {
      const resolvedToken = await getOrCreateServerVisitorToken();
      visitorToken = normalizeString(resolvedToken);
      visitorTokenSource = visitorToken ? "generated" : "unavailable";
    } catch (tokenError) {
      visitorTokenSource = "unavailable";
      console.warn("[leads.server] visitor token unavailable", {
        businessId,
        eventType,
        message: tokenError instanceof Error ? tokenError.message : "Unknown token error",
      });
    }
  }

  if (normalizeString(args.visitorToken)) {
    visitorTokenSource = "request";
  } else if (visitorToken && visitorTokenSource !== "request") {
    visitorTokenSource = "cookie";
  }

  const insertPayload: LeadEventInsert = {
    business_id: businessId,
    event_type: eventType,
    source: normalizeString(args.source),
    conversation_id: normalizeString(args.conversationId),
    visitor_token: visitorToken,
    visitor_name: normalizeString(args.visitor_name),
    visitor_email: normalizeString(args.visitor_email),
    visitor_phone: normalizeString(args.visitor_phone),
    metadata: normalizeMetadata(args.metadata),
  };

  const { error } = await supabase.from("lead_events").insert(insertPayload);

  if (error) {
    throw createLeadTrackingError("Failed to insert lead event", {
      status: 500,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
  }

  return {
    ok: true,
    visitorToken,
    visitorTokenSource,
    insertPayload,
  };
}
