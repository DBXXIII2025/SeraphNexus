"use client";

import { useState } from "react";

export default function ConnectStripeButton({
  businessId,
  label = "Connect Stripe",
  className,
  endpoint = "/api/stripe/connect",
  loadingLabel = "Redirecting to Stripe...",
}: {
  businessId: string;
  label?: string;
  className?: string;
  endpoint?: string;
  loadingLabel?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ businessId }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to start Stripe onboarding");
      }

      if (!data?.url || typeof data.url !== "string") {
        throw new Error("Stripe onboarding URL was not returned");
      }

      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to connect Stripe");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleConnect}
        disabled={loading}
        className={`rounded-md bg-[var(--success)] px-4 py-2 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--success)] disabled:cursor-not-allowed disabled:opacity-60 ${
          className || ""
        }`}
      >
        {loading ? loadingLabel : label}
      </button>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
