"use client";

import { useEffect, useRef } from "react";
import { trackLeadEvent, type LeadEventType } from "@/lib/leadTracker";

export default function LeadEventTracker({
  businessId,
  eventType,
  source,
  conversationId,
  metadata,
}: {
  businessId: string;
  eventType: LeadEventType;
  source?: string | null;
  conversationId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) {
      return;
    }

    firedRef.current = true;

    void trackLeadEvent({
      businessId,
      eventType,
      source: source || null,
      conversationId: conversationId || null,
      metadata: metadata || null,
    }).catch((error) => {
      if (process.env.NODE_ENV !== "production") {
        console.error("[lead-tracker] client event failed:", error);
      }
    });
  }, [businessId, conversationId, eventType, metadata, source]);

  return null;
}
