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
  const nextParam = searchParams.get("next");
  const inviteToken = searchParams.get("invite") || "";
  const invitedEmail = searchParams.get("email") || "";

  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

    if (inviteToken && data.user?.id) {
      try {
        const response = await fetch("/api/auth/access-grants/activate-invite", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inviteToken,
            userId: data.user.id,
            email,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(
            typeof payload?.error === "string"
              ? payload.error
              : "Invite activation failed."
          );
        }
      } catch (activationError) {
        setError(
          activationError instanceof Error
            ? activationError.message
            : "Account created, but trial invite activation failed."
        );
        setLoading(false);
        return;
      }
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
    <div className="flex min-h-screen items-center justify-center bg-[var(--page-bg)] px-4 text-[var(--text-main)]">
      <form
        onSubmit={handleSignup}
        className="w-full max-w-sm rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]"
      >
        <h1 className="mb-2 text-center text-2xl font-semibold">Sign Up</h1>
        <p className="mb-6 text-center text-sm text-[var(--text-soft)]">
          Create your Seraph Nexus account.
        </p>

        {inviteToken ? (
          <div className="mb-4 rounded-lg border border-[var(--border-soft)] bg-[var(--accent-muted)] px-3 py-2 text-xs text-[var(--accent)]">
            Private trial invite detected. Sign up with the invited email to activate it.
          </div>
        ) : null}

        <div className="mb-4 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--text-soft)]">
          New accounts continue into the correct workspace path after signup.
        </div>

        <label className="mb-2 block text-sm text-[var(--text-soft)]">Email</label>
        <input
          type="email"
          className="mb-3 w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface)] p-2 text-[var(--text-main)] outline-none focus:ring-2 focus:ring-[#D1D5DB]"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />

        <label className="mb-2 block text-sm text-[var(--text-soft)]">Password</label>
        <input
          type="password"
          className="mb-3 w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface)] p-2 text-[var(--text-main)] outline-none focus:ring-2 focus:ring-[#D1D5DB]"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          required
        />

        <label className="mb-2 block text-sm text-[var(--text-soft)]">
          Confirm Password
        </label>
        <input
          type="password"
          className="mb-3 w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface)] p-2 text-[var(--text-main)] outline-none focus:ring-2 focus:ring-[#D1D5DB]"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter your password"
          autoComplete="new-password"
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
          {loading ? "Creating account..." : "Create Account"}
        </button>

        <p className="mt-4 text-center text-sm text-[var(--text-soft)]">
          Already have an account?{" "}
          <Link
            href={`/login?next=${encodeURIComponent(nextPath)}`}
            className="text-[var(--accent)] hover:text-[var(--accent-soft)]"
          >
            Log In
          </Link>
        </p>
      </form>
    </div>
  );
}
