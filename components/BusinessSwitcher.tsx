"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Business = {
  id: string;
  name: string;
};

type SetActiveBusinessResponse = {
  success?: boolean;
  redirectTo?: string;
  error?: string;
};

export default function BusinessSwitcher({
  businesses,
  activeBusinessId,
}: {
  businesses: Business[];
  activeBusinessId?: string | null;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!businesses || businesses.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-4 text-sm text-[var(--text-soft)]">
        No businesses yet.
      </div>
    );
  }

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const businessId = e.target.value;
    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/set-active-business", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ businessId }),
      });

      const data = (await res.json().catch(() => ({}))) as SetActiveBusinessResponse;

      if (!res.ok) {
        throw new Error(data?.error || "Failed to switch business");
      }

      if (data.redirectTo && typeof data.redirectTo === "string") {
        router.replace(data.redirectTo);
        return;
      }

      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to switch business");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
        Active business
      </label>
      <select
        onChange={handleChange}
        defaultValue={activeBusinessId || businesses[0]?.id}
        className="input-field"
        disabled={isSaving}
      >
        {businesses.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <div className="flex min-h-[20px] items-center justify-between gap-3">
        <span className="text-xs text-[var(--text-muted)]">
          {isSaving ? "Switching active workspace..." : "All admin data stays scoped to this business."}
        </span>
        {error ? <span className="text-xs text-[var(--accent-soft)]">{error}</span> : null}
      </div>
    </div>
  );
}
