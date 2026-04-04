"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import TransactionConfirmationShell from "@/components/confirmation/TransactionConfirmationShell";
import type { TransactionConfirmationPayload } from "@/lib/transactionConfirmation";

function buildMissingSessionConfirmation(
  mode: "booking" | "order"
): TransactionConfirmationPayload {
  return {
    state: "needs_attention",
    transactionType: mode === "booking" ? "service_booking" : "food_order",
    headline:
      mode === "booking" ? "Booking reference missing" : "Order reference missing",
    message:
      "We could not find the checkout session reference needed to load your confirmation.",
    nextStep:
      "Return to the business and retry from the latest checkout link, or contact support if your payment already processed.",
    reference: null,
    paymentSummary: null,
    businessName: null,
    businessSlug: null,
    businessType: null,
    sections: [],
  };
}

function buildNetworkFailureConfirmation(
  mode: "booking" | "order",
  reference: string | null
): TransactionConfirmationPayload {
  return {
    state: "needs_attention",
    transactionType: mode === "booking" ? "service_booking" : "food_order",
    headline:
      mode === "booking"
        ? "Booking confirmation unavailable"
        : "Order confirmation unavailable",
    message:
      "We could not load the latest confirmation details for this transaction.",
    nextStep:
      "Refresh this page in a moment. If the issue persists, contact support with your reference.",
    reference,
    paymentSummary: null,
    businessName: null,
    businessSlug: null,
    businessType: null,
    sections: [],
  };
}

export default function TransactionConfirmationClient({
  mode,
}: {
  mode: "booking" | "order";
}) {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const orderRef = searchParams.get("order_ref");
  const [confirmation, setConfirmation] =
    useState<TransactionConfirmationPayload | null>(null);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let cancelled = false;
    let attempts = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      attempts += 1;

      try {
        const endpoint =
          mode === "booking"
            ? `/api/stripe/booking-status?session_id=${encodeURIComponent(sessionId)}`
            : `/api/public/order-status?session_id=${encodeURIComponent(
                sessionId
              )}&order_ref=${encodeURIComponent(orderRef || "")}`;

        const res = await fetch(endpoint, { cache: "no-store" });
        const data = await res.json();

        if (cancelled) {
          return;
        }

        const nextConfirmation = data?.confirmation as
          | TransactionConfirmationPayload
          | undefined;

        if (nextConfirmation) {
          setConfirmation(nextConfirmation);

          if (nextConfirmation.state === "finalizing" && attempts < 8) {
            timeoutId = setTimeout(poll, 2000);
          }

          return;
        }

        setConfirmation(buildNetworkFailureConfirmation(mode, orderRef || sessionId));
      } catch {
        if (!cancelled) {
          setConfirmation(buildNetworkFailureConfirmation(mode, orderRef || sessionId));
        }
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [mode, orderRef, sessionId]);

  return (
    <TransactionConfirmationShell
      confirmation={
        confirmation ||
        (!sessionId
          ? buildMissingSessionConfirmation(mode)
          : {
              state: "finalizing",
              transactionType: mode === "booking" ? "service_booking" : "food_order",
              headline:
                mode === "booking"
                  ? "Finalizing your booking"
                  : "Finalizing your order",
              message:
                "Your payment was received and we are loading the full confirmation now.",
              nextStep:
                "Keep this page open while we finish loading the confirmed details.",
              reference: orderRef || sessionId,
              paymentSummary: "Payment received",
              businessName: null,
              businessSlug: null,
              businessType: null,
              sections: [],
            })
      }
    />
  );
}
