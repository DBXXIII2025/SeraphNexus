"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DISCOUNT_APPLIES_TO_OPTIONS,
  DISCOUNT_TYPE_OPTIONS,
  formatDiscountAppliesTo,
  type DiscountAppliesTo,
  type DiscountCodeRow,
  type DiscountType,
} from "@/lib/discountCodes";

type FormState = {
  id: string | null;
  code: string;
  discount_type: DiscountType;
  discount_value: string;
  applies_to: DiscountAppliesTo;
  minimum_order_amount: string;
  usage_limit: string;
  starts_at: string;
  expires_at: string;
  active: boolean;
};

const EMPTY_FORM: FormState = {
  id: null,
  code: "",
  discount_type: "percent",
  discount_value: "",
  applies_to: "all",
  minimum_order_amount: "",
  usage_limit: "",
  starts_at: "",
  expires_at: "",
  active: true,
};

function formatDateTimeInput(value?: string | null) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  const hour = String(parsed.getUTCHours()).padStart(2, "0");
  const minute = String(parsed.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function formatMoney(value: number | null | undefined) {
  if (!Number.isFinite(Number(value))) {
    return "$0.00";
  }

  return `$${Number(value).toFixed(2)}`;
}

function mapCodeToForm(code: DiscountCodeRow): FormState {
  return {
    id: code.id,
    code: code.code || "",
    discount_type: code.discount_type,
    discount_value: String(code.discount_value ?? ""),
    applies_to: code.applies_to,
    minimum_order_amount:
      code.minimum_order_amount_cents !== null &&
      code.minimum_order_amount_cents !== undefined
        ? (Number(code.minimum_order_amount_cents) / 100).toFixed(2)
        : "",
    usage_limit:
      code.usage_limit !== null && code.usage_limit !== undefined
        ? String(code.usage_limit)
        : "",
    starts_at: formatDateTimeInput(code.starts_at),
    expires_at: formatDateTimeInput(code.expires_at),
    active: code.active !== false,
  };
}

export default function DiscountCodesManager({
  businessId,
  businessType,
}: {
  businessId: string;
  businessType?: string | null;
}) {
  const [codes, setCodes] = useState<DiscountCodeRow[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const codeCountLabel = useMemo(() => `${codes.length} active records loaded`, [codes.length]);

  const loadCodes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/admin/discount-codes?businessId=${encodeURIComponent(businessId)}`,
        {
          cache: "no-store",
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load promo codes.");
      }
      setCodes(Array.isArray(data?.codes) ? data.codes : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load promo codes.");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void loadCodes();
  }, [loadCodes]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit() {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/discount-codes", {
        method: form.id ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId,
          id: form.id,
          code: form.code,
          discount_type: form.discount_type,
          discount_value: form.discount_value,
          applies_to: form.applies_to,
          minimum_order_amount_cents: form.minimum_order_amount,
          usage_limit: form.usage_limit,
          starts_at: form.starts_at || null,
          expires_at: form.expires_at || null,
          active: form.active,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to save promo code.");
      }

      setMessage(form.id ? "Promo code updated." : "Promo code created.");
      setForm(EMPTY_FORM);
      await loadCodes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save promo code.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(code: DiscountCodeRow) {
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/discount-codes", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId,
          id: code.id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to delete promo code.");
      }
      if (form.id === code.id) {
        setForm(EMPTY_FORM);
      }
      setMessage(`Deleted ${code.code}.`);
      await loadCodes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete promo code.");
    }
  }

  return (
    <section className="surface-card p-6">
      <div className="section-header">
        <div className="section-header-copy">
          <p className="section-kicker">Commerce</p>
          <h2 className="section-title">Promo codes</h2>
          <p className="section-description">
            Create business-owned discounts that work across services, rentals, food, and products.
          </p>
        </div>
        <span className="rounded-full border border-[var(--accent-border)] bg-[var(--accent-muted)] px-3 py-1 text-xs text-[var(--accent-soft)]">
          {codeCountLabel}
        </span>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <div className="space-y-3">
          {loading ? (
            <div className="empty-state">Loading promo codes…</div>
          ) : codes.length === 0 ? (
            <div className="empty-state">
              No promo codes yet. Create the first one for this business.
            </div>
          ) : (
            codes.map((code) => (
              <div key={code.id} className="table-row-panel p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--text-strong)]">
                        {code.code}
                      </span>
                      <span className="rounded-full border border-[var(--border-soft)] px-2 py-0.5 text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        {formatDiscountAppliesTo(code.applies_to)}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-[0.14em] ${
                          code.active
                            ? "border-[var(--accent-border)] text-[var(--accent-soft)]"
                            : "border-[var(--border-soft)] text-[var(--text-muted)]"
                        }`}
                      >
                        {code.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-soft)]">
                      {code.discount_type === "percent"
                        ? `${Number(code.discount_value).toFixed(2)}% off`
                        : `${formatMoney(Number(code.discount_value))} off`}
                      {code.minimum_order_amount_cents
                        ? ` · Min ${formatMoney(Number(code.minimum_order_amount_cents) / 100)}`
                        : ""}
                      {code.usage_limit ? ` · Limit ${code.usage_limit}` : ""}
                      {code.usage_count ? ` · Used ${code.usage_count}` : ""}
                    </p>
                    {(code.starts_at || code.expires_at) && (
                      <p className="text-xs text-[var(--text-muted)]">
                        {code.starts_at ? `Starts ${new Date(code.starts_at).toLocaleString()}` : ""}
                        {code.starts_at && code.expires_at ? " · " : ""}
                        {code.expires_at ? `Expires ${new Date(code.expires_at).toLocaleString()}` : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setForm(mapCodeToForm(code))}
                      className="btn-secondary px-3 py-2 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(code)}
                      className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200 transition hover:border-red-400/40 hover:bg-red-400/15"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
          <div className="section-header-copy">
            <p className="section-kicker">
              {form.id ? "Edit code" : "New code"}
            </p>
            <h3 className="section-title text-lg">
              {form.id ? "Update promo code" : "Create promo code"}
            </h3>
            <p className="section-description">
              Applies to {businessType || "this business"} checkout flows. Stripe pricing stays separate.
            </p>
          </div>

          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm text-[var(--text-soft)]">Code</span>
              <input
                value={form.code}
                onChange={(event) => updateForm("code", event.target.value.toUpperCase())}
                placeholder="HVAC10"
                className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-[var(--text-soft)]">Discount type</span>
                <select
                  value={form.discount_type}
                  onChange={(event) =>
                    updateForm("discount_type", event.target.value as DiscountType)
                  }
                  className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                >
                  {DISCOUNT_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option === "percent" ? "Percent" : "Fixed"}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-[var(--text-soft)]">
                  {form.discount_type === "percent" ? "Percent off" : "Fixed amount"}
                </span>
                <input
                  type="number"
                  min="0"
                  step={form.discount_type === "percent" ? "0.01" : "0.01"}
                  value={form.discount_value}
                  onChange={(event) => updateForm("discount_value", event.target.value)}
                  className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-[var(--text-soft)]">Applies to</span>
                <select
                  value={form.applies_to}
                  onChange={(event) =>
                    updateForm("applies_to", event.target.value as DiscountAppliesTo)
                  }
                  className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                >
                  {DISCOUNT_APPLIES_TO_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {formatDiscountAppliesTo(option)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-[var(--text-soft)]">
                  Minimum order amount
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.minimum_order_amount}
                  onChange={(event) => updateForm("minimum_order_amount", event.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-[var(--text-soft)]">Usage limit</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.usage_limit}
                  onChange={(event) => updateForm("usage_limit", event.target.value)}
                  placeholder="Unlimited"
                  className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-strong)]">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => updateForm("active", event.target.checked)}
                />
                Active
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-[var(--text-soft)]">Starts at</span>
                <input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(event) => updateForm("starts_at", event.target.value)}
                  className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-[var(--text-soft)]">Expires at</span>
                <input
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={(event) => updateForm("expires_at", event.target.value)}
                  className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
              </label>
            </div>

            {error ? <p className="text-sm text-red-300">{error}</p> : null}
            {message ? <p className="text-sm text-green-300">{message}</p> : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={saving}
                className="btn-primary px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving…" : form.id ? "Update promo code" : "Create promo code"}
              </button>
              {form.id ? (
                <button
                  type="button"
                  onClick={() => setForm(EMPTY_FORM)}
                  className="btn-secondary px-4 py-2 text-sm font-medium"
                >
                  Cancel edit
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
