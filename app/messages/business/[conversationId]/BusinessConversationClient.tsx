"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type MessageRecord = {
  id: string;
  sender_type: "business" | "client";
  body: string;
  created_at: string | null;
  read_at_business: string | null;
  read_at_client: string | null;
  status?: "pending" | "sent";
};

type ThreadResponse = {
  conversation?: {
    id: string;
    tag: string;
    subject: string | null;
    status: "open" | "resolved" | "archived";
  };
  messages?: MessageRecord[];
};

function formatConversationTag(conversationId: string) {
  const compact = String(conversationId || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  return compact ? `CONV-${compact.slice(0, 6)}` : "CONV";
}

function formatConversationStatus(status: "open" | "resolved" | "archived") {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Pending";
  }

  return new Date(value).toLocaleString();
}

function createClientMessageId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function mergeThreadMessages(current: MessageRecord[], next: MessageRecord[]) {
  const merged = new Map<string, MessageRecord>();

  [...current, ...next].forEach((message) => {
    if (!message.id) {
      return;
    }

    const existing = merged.get(message.id);
    merged.set(message.id, existing ? { ...existing, ...message } : message);
  });

  return Array.from(merged.values()).sort((a, b) => {
    const left = a.created_at ? new Date(a.created_at).getTime() : 0;
    const right = b.created_at ? new Date(b.created_at).getTime() : 0;
    return left - right;
  });
}

export default function BusinessConversationClient({
  conversationId,
  businessName,
  subject,
  initialMessages,
  initialStatus,
  accessToken,
  sourceHref,
}: {
  conversationId: string;
  businessName: string;
  subject: string;
  initialMessages: MessageRecord[];
  initialStatus?: "open" | "resolved" | "archived";
  accessToken?: string | null;
  sourceHref?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<MessageRecord[]>(initialMessages);
  const [conversationTag, setConversationTag] = useState(
    formatConversationTag(conversationId)
  );
  const [status, setStatus] = useState<"open" | "resolved" | "archived">(initialStatus || "open");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [authPresent, setAuthPresent] = useState(true);
  const [pollingEnabled, setPollingEnabled] = useState(true);
  const authLostHandledRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const scrollMessagesToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const element = messagesViewportRef.current;
    if (!element) {
      return;
    }

    element.scrollTo({
      top: element.scrollHeight,
      behavior,
    });
  }, []);
  const backHref =
    sourceHref && sourceHref.startsWith("/") ? sourceHref : "/explore";

  const getCurrentRoute = useCallback(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  const handleUnauthorized = useCallback((reason: string) => {
    if (accessToken) {
      return;
    }

    if (authLostHandledRef.current) {
      return;
    }

    authLostHandledRef.current = true;
    setAuthPresent(false);
    setPollingEnabled(false);
    setSyncError("Your session ended. Redirecting to login.");

    const destination = `/login?next=${encodeURIComponent(getCurrentRoute())}`;

    if (process.env.NODE_ENV !== "production") {
      console.log("[client-messages] auth lost", {
        conversationId,
        reason,
        authPresent: false,
        pollingEnabled: false,
        destination,
      });
    }

    router.replace(destination);
  }, [accessToken, conversationId, getCurrentRoute, router]);

  const sortedMessages = useMemo(
    () =>
      [...messages].sort((a, b) => {
        const left = a.created_at ? new Date(a.created_at).getTime() : 0;
        const right = b.created_at ? new Date(b.created_at).getTime() : 0;
        return left - right;
      }),
    [messages]
  );

  const refreshThread = useCallback(async () => {
    if (!pollingEnabled) {
      return;
    }

    try {
      const res = await fetch(
        `/api/messages/thread?conversationId=${encodeURIComponent(
          conversationId
        )}${accessToken ? `&accessToken=${encodeURIComponent(accessToken)}` : ""}`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as ThreadResponse & { error?: string };
      if (!accessToken && res.status === 401) {
        handleUnauthorized("refreshThread");
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || "Failed to refresh conversation");
      }
      setMessages((current) =>
        mergeThreadMessages(current, Array.isArray(data.messages) ? data.messages : [])
      );
      if (data.conversation?.tag) {
        setConversationTag(data.conversation.tag);
      }
      if (data.conversation?.status) {
        setStatus(data.conversation.status);
      }
      setSyncError(null);
    } catch (err: any) {
      setSyncError(err?.message || "Failed to refresh conversation");
    }
  }, [accessToken, conversationId, handleUnauthorized, pollingEnabled]);

  useEffect(() => {
    let mounted = true;

    if (accessToken) {
      setAuthPresent(true);
      setPollingEnabled(true);
      return () => {
        mounted = false;
      };
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) {
        return;
      }

      const hasSession = Boolean(data.session);
      setAuthPresent(hasSession);
      setPollingEnabled(hasSession);

      if (process.env.NODE_ENV !== "production") {
        console.log("[client-messages] session check", {
          conversationId,
          authPresent: hasSession,
          pollingEnabled: hasSession,
        });
      }

      if (!hasSession) {
        handleUnauthorized("initial-session-check");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const hasSession = Boolean(session);
      setAuthPresent(hasSession);
      setPollingEnabled(hasSession);

      if (process.env.NODE_ENV !== "production") {
        console.log("[client-messages] auth state changed", {
          conversationId,
          event,
          authPresent: hasSession,
          pollingEnabled: hasSession,
        });
      }

      if (!hasSession) {
        handleUnauthorized(`auth-event:${event}`);
      } else {
        authLostHandledRef.current = false;
        setSyncError(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [accessToken, conversationId, handleUnauthorized, pathname, router, searchParams, supabase]);

  useEffect(() => {
    if (!pollingEnabled) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[client-messages] polling disabled", {
          conversationId,
          authPresent,
          pollingEnabled,
        });
      }
      return;
    }

    const interval = window.setInterval(() => {
      void refreshThread();
    }, 4000);

    return () => {
      window.clearInterval(interval);
      if (process.env.NODE_ENV !== "production") {
        console.log("[client-messages] polling cleanup", {
          conversationId,
          authPresent,
          pollingEnabled: false,
        });
      }
    };
  }, [authPresent, conversationId, pollingEnabled, refreshThread]);

  useEffect(() => {
    if (!stickToBottomRef.current) {
      return;
    }

    scrollMessagesToBottom();
  }, [scrollMessagesToBottom, sortedMessages]);

  useEffect(() => {
    const element = messagesViewportRef.current;
    if (!element) {
      return;
    }

    const handleScroll = () => {
      const distanceFromBottom =
        element.scrollHeight - element.scrollTop - element.clientHeight;
      stickToBottomRef.current = distanceFromBottom < 72;
    };

    handleScroll();
    element.addEventListener("scroll", handleScroll, { passive: true });
    return () => element.removeEventListener("scroll", handleScroll);
  }, [conversationId]);

  useEffect(() => {
    stickToBottomRef.current = true;
    const frame = window.requestAnimationFrame(() => {
      scrollMessagesToBottom();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [conversationId, scrollMessagesToBottom]);

  useEffect(() => {
    if (!pollingEnabled) {
      return;
    }

    const channel = supabase
      .channel(`client-messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          void refreshThread();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, pollingEnabled, refreshThread, supabase]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || loading || !authPresent) {
      return;
    }

    setLoading(true);
    setError(null);
    const clientMessageId = createClientMessageId();
    const optimisticId = `pending-${clientMessageId}`;
    const optimisticMessage: MessageRecord = {
      id: optimisticId,
      sender_type: "client",
      body,
      created_at: new Date().toISOString(),
      read_at_business: null,
      read_at_client: null,
      status: "pending",
    };
    stickToBottomRef.current = true;
    setMessages((current) => mergeThreadMessages(current, [optimisticMessage]));

    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          body,
          guestToken: accessToken,
          clientMessageId,
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        message?: {
          id: string;
          body: string;
          created_at: string | null;
        };
      };
      if (!accessToken && res.status === 401) {
        handleUnauthorized("sendMessage");
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || "Failed to send message");
      }

      setDraft("");
      if (data.message?.id) {
        setMessages((current) =>
          mergeThreadMessages(
            current.filter((message) => message.id !== optimisticId),
            [
              {
                id: data.message.id,
                sender_type: "client",
                body: data.message.body,
                created_at: data.message.created_at,
                read_at_business: null,
                read_at_client: null,
                status: "sent",
              },
            ]
          )
        );
      }
      await refreshThread();
    } catch (err: any) {
      setMessages((current) => current.filter((message) => message.id !== optimisticId));
      setError(err?.message || "Failed to send message");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-main)] px-4 py-10 text-[var(--text-main)]">
      <div className="mx-auto max-w-4xl rounded-3xl border border-[var(--border-soft)] bg-[var(--panel)] p-6 shadow-[0_18px_48px_rgba(81,61,10,0.08)]">
        <div className="border-b border-[var(--border-soft)] pb-4">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-soft)]">
            {conversationTag} | {formatConversationStatus(status)}
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-[var(--text-strong)]">
            {businessName}
          </h1>
          <p className="mt-2 text-sm text-[var(--text-soft)]">{subject}</p>
          <p className="mt-2 text-xs text-[var(--text-soft)]">Thread ID {conversationId}</p>
          {sourceHref ? (
            <div className="mt-3">
              <Link
                href={backHref}
                className="text-sm text-[var(--accent-strong)] underline-offset-4 hover:underline"
              >
                Back to business page
              </Link>
            </div>
          ) : null}
        </div>

        <div ref={messagesViewportRef} className="mt-6 max-h-[60vh] space-y-3 overflow-y-auto">
          {sortedMessages.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 text-sm text-[var(--text-soft)]">
              No messages yet. Start the conversation below.
            </div>
          ) : (
            sortedMessages.map((message) => (
              <div
                key={message.id}
                className={`rounded-2xl px-4 py-3 ${
                  message.sender_type === "client"
                    ? "ml-auto max-w-[85%] border border-[var(--accent-soft)] bg-[var(--panel-strong)]"
                    : "max-w-[85%] border border-[var(--border-soft)] bg-[var(--surface)]"
                }`}
              >
                <p className="text-sm text-[var(--text-strong)]">{message.body}</p>
                <p className="mt-2 text-xs text-[var(--text-soft)]">
                  {formatTimestamp(message.created_at)}{" "}
                  {message.status === "pending"
                    ? "| Sending..."
                    : message.sender_type === "client"
                      ? message.read_at_business
                        ? "| Read by business"
                        : "| Sent"
                      : message.read_at_client
                        ? "| Read"
                        : "| New"}
                </p>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="mt-6 space-y-3">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write a message"
            className="min-h-[120px] w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-3 text-[var(--text-strong)]"
          />
          {error ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          {syncError ? (
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-800">
              {syncError}
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-[var(--text-soft)]">
              Conversation history is saved and available when you return.
            </p>
            <button
              type="button"
              onClick={handleSend}
              disabled={loading || !draft.trim()}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-contrast)] hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
