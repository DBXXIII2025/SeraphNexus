"use client";

import { AppNotice } from "@/components/ui/app-ui";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-main)] px-4 text-[var(--text-main)]">
      <div className="max-w-lg rounded-3xl border border-[var(--border-soft)] bg-[var(--panel)] p-8 text-center shadow-[0_18px_48px_rgba(81,61,10,0.08)]">
        <h1 className="text-2xl font-semibold text-[var(--text-strong)]">
          Something went wrong
        </h1>
        <p className="mt-3 text-sm text-[var(--text-soft)]">
          The app hit a recoverable error. Try again or refresh the page.
        </p>
        <AppNotice tone="warning" className="mt-5 text-left">
          No customer or payment action was completed from this screen. Retry when you are ready.
        </AppNotice>
        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-contrast)] hover:bg-[var(--accent-strong)]"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
