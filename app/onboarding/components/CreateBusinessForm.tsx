"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CREATE_BUSINESS_TYPE_OPTIONS,
  type BusinessType,
} from "@/lib/businessModules";
import {
  SERVICE_CATEGORY_OPTIONS,
  type ServiceCategory,
} from "@/lib/serviceCategories";

type CreateBusinessResponse = {
  business?: {
    id?: string;
    slug?: string;
  };
  redirectTo?: string;
  error?: string;
};

export default function CreateBusinessForm() {
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType>("service");
  const [serviceCategory, setServiceCategory] = useState<ServiceCategory>("other");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  const handleCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setMessage(null);

    if (!businessName.trim()) {
      setError("Business name is required.");
      return;
    }

    if (!businessType) {
      setError("Please select a business type.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: businessName.trim(),
          business_type: businessType,
          service_category: businessType === "service" ? serviceCategory : null,
        }),
      });

      const data = (await res.json()) as CreateBusinessResponse;

      if (!res.ok) {
        setError(data?.error || "Failed to create business");
        setLoading(false);
        return;
      }

      const businessId = data?.business?.id;
      const redirectTo = data?.redirectTo;

      if (!businessId || typeof businessId !== "string") {
        setError("Business was created but no business ID was returned.");
        setLoading(false);
        return;
      }

      setMessage("Business created. Redirecting to onboarding...");
      router.replace(
        typeof redirectTo === "string" && redirectTo.trim()
          ? redirectTo
          : `/admin/settings?businessId=${businessId}&setup=stripe`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create business");
      setLoading(false);
      return;
    }
  };

  return (
    <form onSubmit={handleCreate} className="space-y-4">
      <div>
        <label className="block text-sm text-[var(--text-soft)]">Business Name</label>
        <input
          className="mt-2 w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface)] p-2 text-[var(--text-main)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="Acme Studios"
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="block text-sm text-[var(--text-soft)]">Business Type</legend>
        <div
          className="mt-2 grid gap-3"
          role="radiogroup"
          aria-label="Business Type"
        >
          {CREATE_BUSINESS_TYPE_OPTIONS.map((option) => {
            const selected = businessType === option.value;

            return (
              <label
                key={option.value}
                className={`block cursor-pointer rounded-xl border p-4 transition focus-within:ring-2 focus-within:ring-green-400/70 ${
                  selected
                    ? "border-[var(--accent)] bg-[var(--accent-muted)] shadow-[var(--shadow-soft)]"
                    : "border-[var(--border-soft)] bg-[var(--surface-muted)] hover:border-[var(--border-strong)] hover:bg-[var(--accent-muted)]"
                }`}
                tabIndex={0}
                aria-checked={selected}
                onKeyDown={(event) => {
                  if (event.key === " " || event.key === "Enter") {
                    event.preventDefault();
                    setBusinessType(option.value);
                  }
                }}
              >
                <input
                  type="radio"
                  name="business_type"
                  value={option.value}
                  checked={selected}
                  onChange={() => setBusinessType(option.value)}
                  className="sr-only"
                />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-[var(--text-strong)]">
                      {option.label}
                    </div>
                    <div className="mt-1 text-sm text-[var(--text-soft)]">
                      {option.description}
                    </div>
                  </div>
                  <div
                    aria-hidden="true"
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                      selected
                        ? "border-[var(--accent)] bg-[var(--accent-muted)]"
                        : "border-[var(--border-soft)] bg-transparent"
                    }`}
                  >
                    <div
                      className={`h-2.5 w-2.5 rounded-full transition ${
                        selected ? "bg-[var(--accent)]" : "bg-transparent"
                      }`}
                    />
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </fieldset>

      {businessType === "service" ? (
        <div>
          <label className="block text-sm text-[var(--text-soft)]">Service Category</label>
          <select
            value={serviceCategory}
            onChange={(event) => setServiceCategory(event.target.value as ServiceCategory)}
            className="mt-2 w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface)] p-2 text-[var(--text-main)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            {SERVICE_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {error && <div className="text-sm text-[var(--destructive)]">{error}</div>}
      {message && <div className="text-sm text-[var(--success)]">{message}</div>}

      <button
        type="submit"
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-[var(--accent-contrast)] transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={loading || !businessName.trim()}
      >
        {loading ? "Creating..." : "Create Business"}
      </button>
    </form>
  );
}
