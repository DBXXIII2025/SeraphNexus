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
        redirectTo: `${origin}/reset-password`,
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
    <div className="min-h-screen flex items-center justify-center bg-black text-white px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-zinc-900/80 border border-white/10 p-6 rounded-xl w-full max-w-sm shadow-lg"
      >
        <h1 className="text-2xl font-semibold mb-2 text-center">
          Reset Password
        </h1>
        <p className="text-sm text-gray-400 mb-6 text-center">
          Enter your account email and we&apos;ll send you a reset link.
        </p>

        <label className="block text-sm text-gray-300 mb-2">Email</label>
        <input
          type="email"
          className="w-full p-2 text-black rounded-md mb-3 outline-none focus:ring-2 focus:ring-purple-500"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />

        {error ? <div className="mb-3 text-sm text-red-400">{error}</div> : null}
        {message ? (
          <div className="mb-3 text-sm text-green-400">{message}</div>
        ) : null}

        <button
          type="submit"
          className="w-full bg-purple-600 py-2 rounded-md hover:bg-purple-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={loading}
        >
          {loading ? "Sending reset link..." : "Send reset link"}
        </button>

        <p className="mt-4 text-center text-sm text-gray-400">
          Remembered your password?{" "}
          <Link href="/login" className="text-purple-300 hover:text-purple-200">
            Back to login
          </Link>
        </p>
      </form>
    </div>
  );
}
