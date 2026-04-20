"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 8;

function getResetErrorMessage(message: string | null | undefined) {
  const normalized = (message || "").toLowerCase();

  if (normalized.includes("session")) {
    return "This password reset link is invalid or expired.";
  }

  if (normalized.includes("password")) {
    return "Choose a stronger password with at least 8 characters.";
  }

  return "We couldn't reset your password right now.";
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    const initializeRecovery = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      if (session) {
        setError(null);
      } else {
        setError("Open the reset link from your email to choose a new password.");
      }

      setReady(true);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) {
        return;
      }

      if (event === "PASSWORD_RECOVERY" || session) {
        setError(null);
        setReady(true);
      }
    });

    void initializeRecovery();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(getResetErrorMessage(updateError.message));
      setLoading(false);
      return;
    }

    setMessage("Password updated. Redirecting to login...");
    setLoading(false);

    window.setTimeout(() => {
      router.push("/login?reset=success");
      router.refresh();
    }, 1200);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--page-bg)] px-4 text-[var(--text-main)]">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]"
      >
        <h1 className="text-2xl font-semibold mb-2 text-center">
          Choose New Password
        </h1>
        <p className="mb-6 text-center text-sm text-[var(--text-soft)]">
          Enter and confirm your new password to finish recovery.
        </p>

        <label className="mb-2 block text-sm text-[var(--text-soft)]">New Password</label>
        <input
          type="password"
          className="mb-3 w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface)] p-2 text-[var(--text-main)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          required
        />

        <label className="mb-2 block text-sm text-[var(--text-soft)]">
          Confirm Password
        </label>
        <input
          type="password"
          className="mb-3 w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface)] p-2 text-[var(--text-main)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Re-enter your new password"
          autoComplete="new-password"
          required
        />

        {!ready && !error ? (
          <div className="mb-3 text-sm text-[var(--text-soft)]">
            Checking recovery session...
          </div>
        ) : null}
        {error ? <div className="mb-3 text-sm text-[var(--destructive)]">{error}</div> : null}
        {message ? (
          <div className="mb-3 text-sm text-[var(--success)]">{message}</div>
        ) : null}

        <button
          type="submit"
          className="w-full rounded-md bg-[var(--accent)] py-2 text-[var(--accent-contrast)] transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading || !ready}
        >
          {loading ? "Updating password..." : "Update password"}
        </button>
      </form>
    </div>
  );
}
