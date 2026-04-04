"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function isValidEmail(email: string) {
  return /\S+@\S+\.\S+/.test(email);
}

function getSignupErrorMessage(message: string | null | undefined) {
  const normalized = (message || "").toLowerCase();

  if (normalized.includes("already registered") || normalized.includes("already been registered")) {
    return "An account with this email already exists.";
  }

  if (normalized.includes("password")) {
    return "Choose a stronger password with at least 8 characters.";
  }

  return "We couldn't create your account right now.";
}

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nextParam = searchParams.get("next");
  const nextPath =
    nextParam && nextParam.startsWith("/") ? nextParam : "/admin";

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (process.env.NODE_ENV !== "production") {
      console.log("[signup] result:", {
        email,
        hasUser: Boolean(data.user),
        hasSession: Boolean(data.session),
        error: signupError?.message || null,
      });
    }

    if (signupError) {
      setError(getSignupErrorMessage(signupError.message));
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push(nextPath);
      router.refresh();
      return;
    }

    setMessage(
      "Account created. Check your email to confirm your account, then sign in with your password."
    );
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
      <form
        onSubmit={handleSignup}
        className="w-full max-w-sm rounded-xl border border-white/10 bg-zinc-900/80 p-6 shadow-lg"
      >
        <h1 className="mb-2 text-center text-2xl font-semibold">Sign Up</h1>
        <p className="mb-6 text-center text-sm text-gray-400">
          Create your Seraph Nexus account.
        </p>

        <div className="mb-4 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-gray-400">
          New accounts continue into the correct workspace path after signup.
        </div>

        <label className="mb-2 block text-sm text-gray-300">Email</label>
        <input
          type="email"
          className="mb-3 w-full rounded-md p-2 text-black outline-none focus:ring-2 focus:ring-purple-500"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />

        <label className="mb-2 block text-sm text-gray-300">Password</label>
        <input
          type="password"
          className="mb-3 w-full rounded-md p-2 text-black outline-none focus:ring-2 focus:ring-purple-500"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          required
        />

        <label className="mb-2 block text-sm text-gray-300">
          Confirm Password
        </label>
        <input
          type="password"
          className="mb-3 w-full rounded-md p-2 text-black outline-none focus:ring-2 focus:ring-purple-500"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter your password"
          autoComplete="new-password"
          required
        />

        {error ? <div className="mb-3 text-sm text-red-400">{error}</div> : null}
        {message ? (
          <div className="mb-3 text-sm text-green-400">{message}</div>
        ) : null}

        <button
          type="submit"
          className="w-full rounded-md bg-purple-600 py-2 transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Creating account..." : "Create Account"}
        </button>

        <p className="mt-4 text-center text-sm text-gray-400">
          Already have an account?{" "}
          <Link
            href={`/login?next=${encodeURIComponent(nextPath)}`}
            className="text-purple-300 hover:text-purple-200"
          >
            Log In
          </Link>
        </p>
      </form>
    </div>
  );
}
