"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function isValidEmail(email: string) {
  return /\S+@\S+\.\S+/.test(email);
}

function getLoginErrorMessage(message: string | null | undefined) {
  const normalized = (message || "").toLowerCase();

  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("user not found") ||
    normalized.includes("invalid_grant")
  ) {
    return "Email or password is incorrect.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Confirm your email address before signing in.";
  }

  if (normalized.includes("too many requests")) {
    return "Too many login attempts. Please wait a moment and try again.";
  }

  return "We couldn't sign you in right now.";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  const supabase = createClient();
  const nextParam = searchParams.get("next");
  const nextPath =
    nextParam && nextParam.startsWith("/") ? nextParam : "/admin";

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);

    if (!isValidEmail(email)) {
      setError("Please enter a valid email.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(getLoginErrorMessage(error.message));
      setLoading(false);
      return;
    }

    router.push(nextPath);
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white px-4">
      <form
        onSubmit={handleLogin}
        className="bg-zinc-900/80 border border-white/10 p-6 rounded-xl w-full max-w-sm shadow-lg"
      >
        <h1 className="text-2xl font-semibold mb-2 text-center">Login</h1>
        <p className="text-sm text-gray-400 mb-6 text-center">
          Sign in with your email and password.
        </p>

        <div className="mb-4 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-gray-400">
          You will continue to the correct workspace route after sign-in.
        </div>

        <label className="block text-sm text-gray-300 mb-2">Email</label>
        <input
          type="email"
          className="w-full p-2 text-black rounded-md mb-3 outline-none focus:ring-2 focus:ring-purple-500"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />

        <label className="block text-sm text-gray-300 mb-2">Password</label>
        <input
          type="password"
          className="w-full p-2 text-black rounded-md mb-3 outline-none focus:ring-2 focus:ring-purple-500"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          autoComplete="current-password"
          required
        />

        {error && (
          <div className="text-sm text-red-400 mb-3">{error}</div>
        )}

        <button
          type="submit"
          className="w-full bg-purple-600 py-2 rounded-md hover:bg-purple-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={loading || !email || !password}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <p className="mt-4 text-center text-sm text-gray-400">
          Need an account?{" "}
          <Link
            href={`/signup?next=${encodeURIComponent(nextPath)}`}
            className="text-purple-300 hover:text-purple-200"
          >
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}
