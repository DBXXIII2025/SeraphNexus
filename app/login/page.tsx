"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [platformBrand, setPlatformBrand] = useState<{
    siteName: string;
    logoUrl: string | null;
  }>({ siteName: "Seraph Nexus", logoUrl: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const nextParam = searchParams.get("next");
  const nextPath =
    nextParam && nextParam.startsWith("/") ? nextParam : "/admin";
  const resetStatus = searchParams.get("reset");
  const platformInitials =
    platformBrand.siteName
      .split(/\s+/)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("")
      .slice(0, 2) || "SN";

  useEffect(() => {
    let active = true;

    fetch("/api/platform-branding", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        console.info("[platform-branding] login page branding payload read", {
          siteName: payload?.siteName || null,
          logoUrl: payload?.logoUrl || null,
          renderDecision: payload?.logoUrl ? "logo" : "fallback",
        });

        if (!active) {
          return;
        }

        setPlatformBrand({
          siteName: String(payload?.siteName || "").trim() || "Seraph Nexus",
          logoUrl:
            typeof payload?.logoUrl === "string" && payload.logoUrl.trim()
              ? payload.logoUrl.trim()
              : null,
        });
      })
      .catch((brandingError) => {
        console.error("[platform-branding] login page branding read failed", brandingError);
      });

    return () => {
      active = false;
    };
  }, []);

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
    <div className="flex min-h-screen items-center justify-center bg-[var(--page-bg)] px-4 text-[var(--text-main)]">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]"
      >
        <div className="mb-5 flex flex-col items-center gap-2">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--surface-raised)] text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-main)]">
            {platformBrand.logoUrl ? (
              <img
                src={platformBrand.logoUrl}
                alt={`${platformBrand.siteName} logo`}
                className="h-full w-full object-contain"
              />
            ) : (
              platformInitials
            )}
          </div>
          <p className="text-center text-sm font-medium text-[var(--text-main)]">
            {platformBrand.siteName}
          </p>
        </div>
        <h1 className="text-2xl font-semibold mb-2 text-center">Login</h1>
        <p className="mb-6 text-center text-sm text-[var(--text-soft)]">
          Sign in with your email and password.
        </p>

        <div className="mb-4 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--text-soft)]">
          You will continue to the correct workspace route after sign-in.
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
          placeholder="Enter your password"
          autoComplete="current-password"
          required
        />

        <div className="mb-3 text-right">
          <Link
            href="/forgot-password"
            className="text-sm text-[var(--accent)] hover:text-[var(--accent-soft)]"
          >
            Forgot password?
          </Link>
        </div>

        {resetStatus === "success" && !error ? (
          <div className="mb-3 text-sm text-[var(--success)]">
            Password updated. Sign in with your new password.
          </div>
        ) : null}

        {error && (
          <div className="mb-3 text-sm text-[var(--destructive)]">{error}</div>
        )}

        <button
          type="submit"
          className="inline-flex rounded-md bg-[var(--accent)] px-4 py-2 text-[var(--accent-contrast)] transition hover:bg-[var(--accent-soft)] active:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading || !email || !password}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <p className="mt-4 text-center text-sm text-[var(--text-soft)]">
          Need an account?{" "}
          <Link
            href={`/signup?next=${encodeURIComponent(nextPath)}`}
            className="text-[var(--accent)] hover:text-[var(--accent-soft)]"
          >
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}
