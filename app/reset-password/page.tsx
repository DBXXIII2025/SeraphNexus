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
    <div className="min-h-screen flex items-center justify-center bg-black text-white px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-zinc-900/80 border border-white/10 p-6 rounded-xl w-full max-w-sm shadow-lg"
      >
        <h1 className="text-2xl font-semibold mb-2 text-center">
          Choose New Password
        </h1>
        <p className="text-sm text-gray-400 mb-6 text-center">
          Enter and confirm your new password to finish recovery.
        </p>

        <label className="block text-sm text-gray-300 mb-2">New Password</label>
        <input
          type="password"
          className="w-full p-2 text-black rounded-md mb-3 outline-none focus:ring-2 focus:ring-purple-500"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          required
        />

        <label className="block text-sm text-gray-300 mb-2">
          Confirm Password
        </label>
        <input
          type="password"
          className="w-full p-2 text-black rounded-md mb-3 outline-none focus:ring-2 focus:ring-purple-500"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Re-enter your new password"
          autoComplete="new-password"
          required
        />

        {!ready && !error ? (
          <div className="mb-3 text-sm text-gray-400">
            Checking recovery session...
          </div>
        ) : null}
        {error ? <div className="mb-3 text-sm text-red-400">{error}</div> : null}
        {message ? (
          <div className="mb-3 text-sm text-green-400">{message}</div>
        ) : null}

        <button
          type="submit"
          className="w-full bg-purple-600 py-2 rounded-md hover:bg-purple-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={loading || !ready}
        >
          {loading ? "Updating password..." : "Update password"}
        </button>
      </form>
    </div>
  );
}
