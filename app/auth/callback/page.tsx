"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type SupportedOtpType =
  | "recovery"
  | "invite"
  | "magiclink"
  | "email"
  | "signup"
  | "email_change";

function normalizeNextPath(nextPath: string | null) {
  return nextPath && nextPath.startsWith("/") ? nextPath : "/admin";
}

function normalizeOtpType(value: string | null): SupportedOtpType | null {
  return value === "recovery" ||
    value === "invite" ||
    value === "magiclink" ||
    value === "email" ||
    value === "signup" ||
    value === "email_change"
    ? value
    : null;
}

function buildErrorPath(nextPath: string) {
  return nextPath === "/reset-password"
    ? "/reset-password?error=expired"
    : "/login?error=auth";
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const finishAuth = async () => {
      const nextPath = normalizeNextPath(searchParams.get("next"));
      const redirectOnError = buildErrorPath(nextPath);
      const code = searchParams.get("code");
      const tokenHash = searchParams.get("token_hash");
      const otpType = normalizeOtpType(searchParams.get("type"));
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const hashError =
        hashParams.get("error_description") ||
        hashParams.get("error") ||
        searchParams.get("error_description") ||
        searchParams.get("error");

      if (hashError) {
        router.replace(redirectOnError);
        return;
      }

      try {
        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            throw exchangeError;
          }
        } else if (tokenHash && otpType) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType,
          });

          if (verifyError) {
            throw verifyError;
          }
        } else if (
          hashParams.get("access_token") &&
          hashParams.get("refresh_token")
        ) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: hashParams.get("access_token") || "",
            refresh_token: hashParams.get("refresh_token") || "",
          });

          if (sessionError) {
            throw sessionError;
          }
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session && nextPath === "/reset-password") {
          router.replace(redirectOnError);
          return;
        }

        if (window.location.hash) {
          window.history.replaceState(
            null,
            "",
            `${window.location.pathname}${window.location.search}`
          );
        }

        router.replace(nextPath);
      } catch {
        if (!active) {
          return;
        }

        setError("This authentication link is invalid or expired.");
        router.replace(redirectOnError);
      }
    };

    void finishAuth();

    return () => {
      active = false;
    };
  }, [router, searchParams, supabase]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--page-bg)] px-4 text-[var(--text-main)]">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-6 text-center shadow-[var(--shadow-card)]">
        <h1 className="text-xl font-semibold">Securing your session…</h1>
        <p className="mt-3 text-sm text-[var(--text-soft)]">
          Completing your sign-in or recovery link.
        </p>
        {error ? (
          <p className="mt-4 text-sm text-[var(--destructive)]">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
