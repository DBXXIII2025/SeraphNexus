"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LegalDocument } from "@/lib/legalDocuments";

export default function LegalAcceptanceForm({
  businessId,
  nextPath,
  documents,
  disabled = false,
}: {
  businessId: string;
  nextPath: string;
  documents: LegalDocument[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allChecked = useMemo(() => {
    return documents.every((document) => checked[document.documentKey] === true);
  }, [checked, documents]);

  async function handleContinue() {
    if (!allChecked || loading || disabled) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/legal/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId,
          nextPath,
          documentKeys: documents.map((document) => document.documentKey),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save legal acceptance.");
      }

      router.replace(
        typeof data?.redirectTo === "string" && data.redirectTo.startsWith("/")
          ? data.redirectTo
          : nextPath
      );
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to save legal acceptance."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {documents.map((document) => (
        <div
          key={document.documentKey}
          className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-strong)]">
                {document.title}
              </h2>
              <p className="mt-1 text-sm text-[var(--text-soft)]">
                document_key: {document.documentKey}
              </p>
              <p className="text-sm text-[var(--text-soft)]">
                document_version: {document.documentVersion}
              </p>
              <p className="text-sm text-[var(--text-soft)]">
                last_updated: {document.lastUpdated}
              </p>
            </div>
            <Link
              href={`/legal/${document.documentKey}`}
              className="rounded-xl border border-[var(--border-soft)] px-4 py-2 text-sm text-[var(--text-strong)] hover:bg-[var(--panel-strong)]"
              target="_blank"
            >
              Read full document
            </Link>
          </div>

          <label className="mt-4 flex items-start gap-3 text-sm text-[var(--text-main)]">
            <input
              type="checkbox"
              checked={checked[document.documentKey] === true}
              disabled={disabled}
              onChange={(event) =>
                setChecked((current) => ({
                  ...current,
                  [document.documentKey]: event.target.checked,
                }))
              }
              className="mt-1 h-4 w-4 rounded border-[var(--border-soft)]"
            />
            <span>{document.acceptanceLabel}</span>
          </label>
        </div>
      ))}

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleContinue}
        disabled={!allChecked || loading || disabled}
        className="inline-flex rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-medium text-[var(--accent-contrast)] hover:bg-[var(--accent-soft)] active:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {disabled
          ? "Legal storage unavailable"
          : loading
            ? "Saving acceptance..."
            : "Continue"}
      </button>
    </div>
  );
}
