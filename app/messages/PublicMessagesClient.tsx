"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getGuestConversationCookieName } from "@/lib/messageThreadCookies";

function getDefaultSourceHref(source: string | null) {
  const value = String(source || "").trim();
  return value || "/explore";
}

export default function PublicMessagesClient({
  businessId,
  businessName,
  source,
  isLoggedIn,
  prefillName,
  prefillEmail,
}: {
  businessId: string;
  businessName: string;
  source: string | null;
  isLoggedIn: boolean;
  prefillName: string;
  prefillEmail: string;
}) {
  const router = useRouter();
  const [senderName, setSenderName] = useState(prefillName);
  const [senderEmail, setSenderEmail] = useState(prefillEmail);
  const [senderPhone, setSenderPhone] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backHref = useMemo(() => getDefaultSourceHref(source), [source]);

  async function handleSend() {
    const trimmedBody = body.trim();
    const trimmedName = senderName.trim();
    const trimmedEmail = senderEmail.trim();

    if (!trimmedBody) {
      setError("Write a message to start the conversation.");
      return;
    }

    if (!isLoggedIn && !trimmedName) {
      setError("Your name is required.");
      return;
    }

    if (!trimmedEmail) {
      setError("Your email is required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId,
          body: trimmedBody,
          source: source || "public_business",
          senderName: trimmedName,
          senderEmail: trimmedEmail,
          senderPhone: senderPhone.trim(),
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        threadPath?: string;
        guestToken?: string | null;
      };

      if (!res.ok || !data.threadPath) {
        throw new Error(data.error || "Failed to start conversation");
      }

      if (data.guestToken) {
        document.cookie = `${getGuestConversationCookieName(
          businessId
        )}=${encodeURIComponent(data.guestToken)}; Path=/; Max-Age=31536000; SameSite=Lax`;
      }

      router.replace(data.threadPath);
    } catch (err: any) {
      setError(err?.message || "Failed to start conversation");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-main)] px-4 py-10 text-[var(--text-main)]">
      <div className="mx-auto max-w-3xl rounded-3xl border border-[var(--border-soft)] bg-[var(--panel)] p-8 shadow-[0_18px_48px_rgba(81,61,10,0.08)]">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-soft)]">
          Message business
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-[var(--text-strong)]">
          {businessName}
        </h1>
        <p className="mt-3 text-sm text-[var(--text-soft)]">
          Send a message and continue the conversation from this public thread.
        </p>

        <div className="mt-6 space-y-4">
          <input
            value={senderName}
            onChange={(event) => setSenderName(event.target.value)}
            placeholder="Your name"
            className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-[var(--text-strong)]"
          />
          <input
            value={senderEmail}
            onChange={(event) => setSenderEmail(event.target.value)}
            placeholder="Your email"
            type="email"
            className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-[var(--text-strong)]"
          />
          <input
            value={senderPhone}
            onChange={(event) => setSenderPhone(event.target.value)}
            placeholder="Phone (optional)"
            type="tel"
            className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-[var(--text-strong)]"
          />
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write your message"
            className="min-h-[160px] w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-3 text-[var(--text-strong)]"
          />
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-between gap-3">
          <Link
            href={backHref}
            className="rounded-xl border border-[var(--border-soft)] px-4 py-2 text-sm text-[var(--text-strong)] transition hover:bg-[var(--panel-strong)]"
          >
            Back
          </Link>
          <button
            type="button"
            onClick={handleSend}
            disabled={submitting}
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-contrast)] hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Starting..." : "Send message"}
          </button>
        </div>
      </div>
    </div>
  );
}
