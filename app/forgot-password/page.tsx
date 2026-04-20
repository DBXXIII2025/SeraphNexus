"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function isValidEmail(email: string) {
  return /\S+@\S+\.\S+/.test(email);
}

function getOrigin() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.origin;
}

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    const origin = getOrigin();
    if (!origin) {
      setError("We couldn't prepare password recovery right now.");
      return;
    }

    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${origin}/auth/callback?next=/reset-password`,
      }
    );

    if (resetError) {
      setError(resetError.message || "Failed to send reset email.");
      setLoading(false);
      return;
    }

    setMessage(
      "Password reset email sent. Check your inbox for the recovery link."
    );
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--page-bg)] px-4 text-[var(--text-main)]">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]"
      >
        <h1 className="text-2xl font-semibold mb-2 text-center">
          Reset Password
        </h1>
        <p className="mb-6 text-center text-sm text-[var(--text-soft)]">
          Enter your account email and we&apos;ll send you a reset link.
        </p>

        <label className="mb-2 block text-sm text-[var(--text-soft)]">Email</label>
        <input
          type="email"
          className="mb-3 w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface)] p-2 text-[var(--text-main)] outline-none focus:ring-2 focus:ring-[#D1D5DB]"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />

        {error ? <div className="mb-3 text-sm text-[var(--destructive)]">{error}</div> : null}
        {message ? (
          <div className="mb-3 text-sm text-[var(--success)]">{message}</div>
        ) : null}

        <button
          type="submit"
          className="inline-flex rounded-md bg-[var(--accent)] px-4 py-2 text-[var(--accent-contrast)] transition hover:bg-[var(--accent-soft)] active:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Sending reset link..." : "Send reset link"}
        </button>

        <p className="mt-4 text-center text-sm text-[var(--text-soft)]">
          Remembered your password?{" "}
          <Link href="/login" className="text-[var(--accent)] hover:text-[var(--accent-soft)]">
            Back to login
          </Link>
        </p>
      </form>
    </div>
  );
}
