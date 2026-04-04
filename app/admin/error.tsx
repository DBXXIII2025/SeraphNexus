"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-white">
      <h1 className="text-2xl font-semibold">Admin section unavailable</h1>
      <p className="mt-3 text-sm text-red-100">
        This admin page hit a recoverable error. Retry without leaving the dashboard.
      </p>
      <p className="mt-3 text-xs text-red-200">
        {error?.message || "Unexpected admin error"}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-100"
      >
        Retry
      </button>
    </div>
  );
}
