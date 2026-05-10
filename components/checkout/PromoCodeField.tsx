"use client";

import { useEffect, useState } from "react";
import type { AppliedDiscount } from "@/lib/discountCodes";

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function PromoCodeField({
  businessId,
  checkoutType,
  subtotalCents,
  disabled,
  onAppliedChange,
}: {
  businessId: string;
  checkoutType: "service" | "rental" | "food" | "product";
  subtotalCents: number;
  disabled?: boolean;
  onAppliedChange?: (discount: AppliedDiscount | null) => void;
}) {
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<AppliedDiscount | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setApplied(null);
    setMessage(null);
    setError(null);
    onAppliedChange?.(null);
  }, [businessId, checkoutType, subtotalCents, onAppliedChange]);

  async function applyCode() {
    setError(null);
    setMessage(null);

    if (!code.trim()) {
      setError("Enter a promo code first.");
      return;
    }

    if (!Number.isFinite(subtotalCents) || subtotalCents <= 0) {
      setError("Add at least one valid item before applying a promo code.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/checkout/discount", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          business_id: businessId,
          type: checkoutType,
          subtotal_cents: subtotalCents,
          code,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Promo code could not be applied.");
      }
      setApplied(data.discount || null);
      onAppliedChange?.(data.discount || null);
      setCode(String(data.discount?.code || code).trim().toUpperCase());
      setMessage(`Applied ${String(data.discount?.code || code).trim().toUpperCase()}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Promo code could not be applied.";
      setApplied(null);
      onAppliedChange?.(null);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function clearCode() {
    setApplied(null);
    setError(null);
    setMessage(null);
    setCode("");
    onAppliedChange?.(null);
  }

  const finalTotalCents = applied?.finalTotalCents ?? subtotalCents;

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          Promo code
        </p>
        {applied ? (
          <button
            type="button"
            onClick={clearCode}
            className="text-xs text-[var(--text-soft)] transition hover:text-[var(--text-strong)]"
          >
            Clear
          </button>
        ) : null}
      </div>

      <div className="flex gap-2">
        <input
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="Enter code"
          disabled={disabled || loading}
          className="min-w-0 flex-1 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-strong)] disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => void applyCode()}
          disabled={disabled || loading}
          className="btn-secondary shrink-0 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Applying…" : "Apply"}
        </button>
      </div>

      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between text-[var(--text-soft)]">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotalCents)}</span>
        </div>
        {applied ? (
          <div className="flex items-center justify-between text-[var(--accent-soft)]">
            <span>Discount ({applied.code})</span>
            <span>-{formatCurrency(applied.discountAmountCents)}</span>
          </div>
        ) : null}
        <div className="flex items-center justify-between font-semibold text-[var(--text-strong)]">
          <span>Total</span>
          <span>{formatCurrency(finalTotalCents)}</span>
        </div>
      </div>

      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      {message ? <p className="text-xs text-green-300">{message}</p> : null}
    </div>
  );
}
