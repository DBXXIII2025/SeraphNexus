"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getAdminStatusBadgeClass } from "@/lib/adminStatus";
import {
  DashboardGrid,
  DashboardPrimaryPanel,
  DashboardSecondaryPanel,
} from "@/components/admin/AdminLayoutSystem";

type ConversationItem = {
  id: string;
  tag: string;
  business_id: string;
  client_name: string | null;
  client_email: string;
  client_phone: string | null;
  subject: string | null;
  source: string | null;
  context_type: string | null;
  context_id: string | null;
  booking_id: string | null;
  last_message_at: string | null;
  last_message_excerpt: string | null;
  business_unread_count: number;
  client_unread_count: number;
  status: "open" | "resolved" | "archived";
};

type MessageItem = {
  id: string;
  sender_type: "business" | "client";
  body: string;
  created_at: string | null;
  read_at_business: string | null;
  read_at_client: string | null;
  status?: "pending" | "sent";
};

type ThreadConversation = {
  id: string;
  tag: string;
  business_id: string;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  subject: string | null;
  context_type: string | null;
  context_id: string | null;
  booking_id: string | null;
  source: string | null;
  owner_user_id: string | null;
  last_message_at: string | null;
  status: "open" | "resolved" | "archived";
};

type ThreadBusiness = {
  id: string;
  name: string | null;
  owner_id: string | null;
  business_type: string | null;
};

type ConversationThreadResponse = {
  conversation?: ThreadConversation;
  business?: ThreadBusiness;
  messages?: MessageItem[];
  error?: string;
};

type ConversationListResponse = {
  conversations?: ConversationItem[];
  targetBusinessId?: string | null;
  error?: string;
};

function isConversationSelected(
  conversations: ConversationItem[],
  conversationId: string | null
) {
  return Boolean(
    conversationId &&
      conversations.some((conversation) => conversation.id === conversationId)
  );
}

function getFallbackConversationId(conversations: ConversationItem[]) {
  return conversations[0]?.id || null;
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "No activity yet";
  }

  return new Date(value).toLocaleString();
}

function createClientMessageId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function mergeThreadMessages(current: MessageItem[], next: MessageItem[]) {
  const merged = new Map<string, MessageItem>();

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

function getContextLabel(conversation: {
  context_type?: string | null;
  context_id?: string | null;
  booking_id?: string | null;
  source?: string | null;
}) {
  const contextType = conversation.context_type || null;
  const contextId = conversation.context_id || conversation.booking_id || null;

  if (contextType && contextId) {
    return `${contextType.replace(/_/g, " ")} - ${contextId}`;
  }

  if (contextType) {
    return contextType.replace(/_/g, " ");
  }

  if (conversation.source) {
    return conversation.source.replace(/_/g, " ");
  }

  return "general inquiry";
}

function getUnreadState(conversation: ConversationItem) {
  if (conversation.business_unread_count > 0) {
    return {
      label:
        conversation.business_unread_count === 1
          ? "Awaiting response"
          : `${conversation.business_unread_count} awaiting response`,
      className: getAdminStatusBadgeClass("awaiting_response"),
    };
  }

  return {
    label: "Up to date",
    className: getAdminStatusBadgeClass("up_to_date"),
  };
}

function getConversationStatusClass(status: ConversationItem["status"] | ThreadConversation["status"]) {
  if (status === "resolved") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "archived") {
    return "border-slate-500/30 bg-slate-500/10 text-slate-200";
  }

  return "border-amber-500/30 bg-amber-500/10 text-amber-200";
}

function formatConversationStatus(status: ConversationItem["status"] | ThreadConversation["status"]) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function AdminMessagesClient({
  businessId,
  activeBusinessId,
  activeBusinessName,
  activeBusinessType,
  scopedBusinessId,
  scopedBusinessName,
  scopedBusinessType,
  canUseAdvancedMessagingTools,
  initialConversations,
  initialSelectedConversationId,
  initialMessages,
}: {
  businessId: string;
  activeBusinessId: string;
  activeBusinessName: string;
  activeBusinessType: string | null;
  scopedBusinessId: string;
  scopedBusinessName: string;
  scopedBusinessType: string | null;
  canUseAdvancedMessagingTools: boolean;
  initialConversations: ConversationItem[];
  initialSelectedConversationId: string | null;
  initialMessages: MessageItem[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [conversations, setConversations] =
    useState<ConversationItem[]>(initialConversations);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    isConversationSelected(initialConversations, initialSelectedConversationId)
      ? initialSelectedConversationId
      : getFallbackConversationId(initialConversations)
  );
  const [messages, setMessages] = useState<MessageItem[]>(initialMessages);
  const [threadConversation, setThreadConversation] =
    useState<ThreadConversation | null>(null);
  const [threadBusiness, setThreadBusiness] = useState<ThreadBusiness | null>(null);
  const [draft, setDraft] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [unsendingMessageId, setUnsendingMessageId] = useState<string | null>(null);
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

  const syncSelectedConversationInUrl = useCallback((conversationId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    const currentConversationId =
      params.get("conversationId") || params.get("conversation");

    if (conversationId) {
      params.set("conversationId", conversationId);
      params.delete("conversation");
    } else {
      params.delete("conversationId");
      params.delete("conversation");
    }

    const query = params.toString();
    if ((conversationId || null) !== (currentConversationId || null)) {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
  }, [pathname, router, searchParams]);

  const handleUnauthorized = useCallback((reason: string) => {
    if (authLostHandledRef.current) {
      return;
    }

    authLostHandledRef.current = true;
    setAuthPresent(false);
    setPollingEnabled(false);
    setSyncError("Your session ended. Redirecting out of messages.");

    if (process.env.NODE_ENV !== "production") {
      console.log("[admin-messages] auth lost", {
        businessId,
        reason,
        authPresent: false,
        pollingEnabled: false,
      });
    }

    router.replace("/explore");
  }, [businessId, router]);

  const selectedConversation = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.id === selectedConversationId
      ) || null,
    [conversations, selectedConversationId]
  );

  const sortedMessages = useMemo(
    () =>
      [...messages].sort((a, b) => {
        const left = a.created_at ? new Date(a.created_at).getTime() : 0;
        const right = b.created_at ? new Date(b.created_at).getTime() : 0;
        return left - right;
      }),
    [messages]
  );

  const refreshConversations = useCallback(async () => {
    if (!pollingEnabled) {
      return;
    }

    try {
      const params = new URLSearchParams();
      params.set("businessId", businessId);

      const res = await fetch(`/api/messages/conversations?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as ConversationListResponse;
      if (res.status === 401) {
        handleUnauthorized("refreshConversations");
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || "Failed to load inbox");
      }

      const nextConversations = Array.isArray(data.conversations)
        ? data.conversations
        : [];
      setConversations(nextConversations);

      if (process.env.NODE_ENV !== "production") {
        console.log("[admin-messages] conversations refreshed", {
          activeBusinessId,
          activeBusinessType,
          scopedBusinessId,
          scopedBusinessType,
          selectedConversationId,
          count: nextConversations.length,
        });
      }

      if (nextConversations.length === 0) {
        if (selectedConversationId !== null) {
          setSelectedConversationId(null);
          syncSelectedConversationInUrl(null);
        }
        setMessages([]);
        setThreadConversation(null);
        setThreadBusiness(null);
      } else if (!isConversationSelected(nextConversations, selectedConversationId)) {
        const fallbackConversationId = getFallbackConversationId(nextConversations);
        setSelectedConversationId(fallbackConversationId);
        syncSelectedConversationInUrl(fallbackConversationId);
        setMessages([]);
        setThreadConversation(null);
        setThreadBusiness(null);
      }

      setSyncError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to refresh inbox";
      setSyncError(message);
    }
  }, [
    activeBusinessId,
    activeBusinessType,
    businessId,
    pollingEnabled,
    scopedBusinessId,
    scopedBusinessType,
    selectedConversationId,
    syncSelectedConversationInUrl,
    handleUnauthorized,
  ]);

  const refreshThread = useCallback(async (targetConversationId: string) => {
    if (!pollingEnabled) {
      return;
    }

    if (!isConversationSelected(conversations, targetConversationId)) {
      setMessages([]);
      setThreadConversation(null);
      setThreadBusiness(null);
      return;
    }

    try {
      const res = await fetch(
        `/api/messages/thread?conversationId=${encodeURIComponent(targetConversationId)}`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as ConversationThreadResponse;
      if (res.status === 401) {
        handleUnauthorized("refreshThread");
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || "Failed to load conversation");
      }

      const nextMessages = Array.isArray(data.messages) ? data.messages : [];
      setMessages((current) => mergeThreadMessages(current, nextMessages));
      setThreadConversation(data.conversation || null);
      setThreadBusiness(data.business || null);

      if (process.env.NODE_ENV !== "production") {
        console.log("[admin-messages] thread updated", {
          conversationId: targetConversationId,
          count: nextMessages.length,
          businessId: data.business?.id || null,
        });
      }

      setSyncError(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to refresh conversation";

      if (message === "Conversation not found") {
        setMessages([]);
        setThreadConversation(null);
        setThreadBusiness(null);
        await refreshConversations();
      }

      setSyncError(message);
    }
  }, [conversations, handleUnauthorized, pollingEnabled, refreshConversations]);

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) {
        return;
      }

      const hasSession = Boolean(data.session);
      setAuthPresent(hasSession);
      setPollingEnabled(hasSession);

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
  }, [businessId, handleUnauthorized, router, supabase]);

  useEffect(() => {
    if (!pollingEnabled) {
      return;
    }

    void refreshConversations();
  }, [businessId, pollingEnabled, refreshConversations]);

  useEffect(() => {
    if (!pollingEnabled) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshConversations();
      if (
        selectedConversationId &&
        isConversationSelected(conversations, selectedConversationId)
      ) {
        void refreshThread(selectedConversationId);
      }
    }, 4000);

    return () => {
      window.clearInterval(interval);
    };
  }, [
    businessId,
    conversations,
    pollingEnabled,
    refreshConversations,
    refreshThread,
    selectedConversationId,
  ]);

  useEffect(() => {
    if (!pollingEnabled) {
      return;
    }

    if (
      selectedConversationId &&
      isConversationSelected(conversations, selectedConversationId)
    ) {
      void refreshThread(selectedConversationId);
    } else {
      setMessages([]);
      setThreadConversation(null);
      setThreadBusiness(null);
    }
  }, [conversations, pollingEnabled, refreshThread, selectedConversationId]);

  useEffect(() => {
    syncSelectedConversationInUrl(selectedConversationId);
  }, [selectedConversationId, syncSelectedConversationInUrl]);

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
  }, [selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }

    stickToBottomRef.current = true;
    const frame = window.requestAnimationFrame(() => {
      scrollMessagesToBottom();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [scrollMessagesToBottom, selectedConversationId]);

  useEffect(() => {
    if (!pollingEnabled || !selectedConversationId) {
      return;
    }

    const channel = supabase
      .channel(`admin-messages-${selectedConversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedConversationId}`,
        },
        () => {
          void refreshThread(selectedConversationId);
          void refreshConversations();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [pollingEnabled, refreshConversations, refreshThread, selectedConversationId, supabase]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || !selectedConversationId || loading || !authPresent) {
      return;
    }

    setLoading(true);
    setError(null);
    const clientMessageId = createClientMessageId();
    const optimisticId = `pending-${clientMessageId}`;
    const optimisticMessage: MessageItem = {
      id: optimisticId,
      sender_type: "business",
      body,
      created_at: new Date().toISOString(),
      read_at_business: null,
      read_at_client: null,
      status: "pending",
    };
    stickToBottomRef.current = true;
    setMessages((current) => mergeThreadMessages(current, [optimisticMessage]));
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === selectedConversationId
          ? {
              ...conversation,
              last_message_at: optimisticMessage.created_at,
              last_message_excerpt: body,
            }
          : conversation
      )
    );

    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId: selectedConversationId,
          body,
          isPrivate: canUseAdvancedMessagingTools ? isPrivate : false,
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
      if (res.status === 401) {
        handleUnauthorized("sendMessage");
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || "Failed to send message");
      }

      setDraft("");
      setIsPrivate(false);
      if (data.message?.id) {
        setMessages((current) =>
          mergeThreadMessages(
            current.filter((message) => message.id !== optimisticId),
            [
              {
                id: data.message.id,
                sender_type: "business",
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
      await refreshThread(selectedConversationId);
      await refreshConversations();
    } catch (err: unknown) {
      setMessages((current) => current.filter((message) => message.id !== optimisticId));
      const message = err instanceof Error ? err.message : "Failed to send message";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUnsend(messageId: string) {
    if (!selectedConversationId || unsendingMessageId) {
      return;
    }

    const confirmed = window.confirm(
      "Unsend this message? It will be hidden from both you and the client."
    );

    if (!confirmed) {
      return;
    }

    setUnsendingMessageId(messageId);
    setError(null);

    try {
      const res = await fetch("/api/messages/unsend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messageId }),
      });

      const data = (await res.json()) as { error?: string };
      if (res.status === 401) {
        handleUnauthorized("unsendMessage");
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || "Failed to unsend message");
      }

      setMessages((current) => current.filter((message) => message.id !== messageId));
      await refreshConversations();
      await refreshThread(selectedConversationId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to unsend message";
      setError(message);
    } finally {
      setUnsendingMessageId(null);
    }
  }

  async function handleStatusChange(nextStatus: "open" | "resolved" | "archived") {
    if (!selectedConversationId || !selectedConversation) {
      return;
    }

    setError(null);

    try {
      const res = await fetch("/api/messages/conversation-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId: selectedConversationId,
          status: nextStatus,
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        conversation?: {
          id: string;
          tag: string;
          status: "open" | "resolved" | "archived";
        };
      };

      if (res.status === 401) {
        handleUnauthorized("changeConversationStatus");
        return;
      }

      if (!res.ok || !data.conversation) {
        throw new Error(data.error || "Failed to update conversation status");
      }

      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === data.conversation!.id
            ? {
                ...conversation,
                status: data.conversation!.status,
                tag: data.conversation!.tag,
              }
            : conversation
        )
      );

      setThreadConversation((current) =>
        current && current.id === data.conversation!.id
          ? {
              ...current,
              status: data.conversation!.status,
              tag: data.conversation!.tag,
            }
          : current
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update conversation status";
      setError(message);
    }
  }

  return (
    <DashboardGrid className="text-[var(--text-main)] xl:grid-cols-[360px,1fr]">
      <DashboardSecondaryPanel>
        <h1 className="text-xl font-semibold">Messages</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
          Inbox for {scopedBusinessName}. Conversations do not cross the active business
          context.
        </p>

        <div className="mt-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-3 text-sm text-[var(--text-soft)]">
          <p>Active business: {activeBusinessName}</p>
          <p>Inbox scope: {scopedBusinessType || activeBusinessType || "business"}</p>
        </div>

        {syncError ? (
          <div className="mt-4 rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-muted)] px-4 py-3 text-sm text-[var(--text-main)]">
            {syncError}
          </div>
        ) : null}

        <div className="mt-5 space-y-3">
          {conversations.length === 0 ? (
            <p className="text-sm text-[var(--text-soft)]">
              No conversations yet for this business.
            </p>
          ) : (
            conversations.map((conversation) => {
              const unread = getUnreadState(conversation);

              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => {
                    setSelectedConversationId(conversation.id);
                    syncSelectedConversationInUrl(conversation.id);
                  }}
                  className={`block w-full rounded-2xl border px-4 py-4 text-left transition ${
                    conversation.id === selectedConversationId
                      ? "border-[var(--destructive-border)] bg-[var(--destructive-bg)] shadow-[var(--shadow-soft)]"
                      : "border-[var(--border-soft)] bg-[var(--surface-raised)] hover:border-[var(--accent-border)] hover:bg-[var(--surface-raised)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        {conversation.tag}
                      </p>
                      <p className="mt-2 font-medium">
                        {conversation.client_name || conversation.client_email || "Client"}
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-soft)]">
                        {conversation.client_email}
                        {conversation.client_phone ? ` | ${conversation.client_phone}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`rounded-full border px-2 py-1 text-xs font-semibold ${getConversationStatusClass(conversation.status)}`}
                      >
                        {formatConversationStatus(conversation.status)}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-1 text-xs font-semibold ${unread.className}`}
                      >
                        {unread.label}
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-[var(--text-strong)]">
                    {conversation.subject || "Conversation"}
                  </p>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    {getContextLabel(conversation)}
                  </p>
                  <p className="mt-2 text-xs text-[var(--text-soft)] line-clamp-2">
                    {conversation.last_message_excerpt || "No messages yet"}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
                    <span>{formatTimestamp(conversation.last_message_at)}</span>
                    <span className="font-medium text-[var(--accent-soft)]">Open thread</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </DashboardSecondaryPanel>

      <DashboardPrimaryPanel>
        {conversations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-raised)] p-6 text-sm text-[var(--text-soft)]">
            No conversations yet. New client messages for this business will appear here.
          </div>
        ) : !selectedConversation ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-raised)] p-6 text-sm text-[var(--text-soft)]">
            Select a conversation to view and respond.
          </div>
        ) : (
          <>
            <div className="border-b border-[var(--border-soft)] pb-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {(threadConversation?.tag || selectedConversation.tag)} | Thread ID{" "}
                    {(threadConversation?.id || selectedConversation.id)}
                  </p>
                  <h2 className="mt-2 text-lg font-semibold">
                    {threadConversation?.client_name ||
                      selectedConversation.client_name ||
                      threadConversation?.client_email ||
                      selectedConversation.client_email ||
                      "Client"}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">
                    {threadConversation?.subject || selectedConversation.subject || "Conversation"}
                  </p>
                </div>
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getConversationStatusClass(
                    threadConversation?.status || selectedConversation.status
                  )}`}
                >
                  {formatConversationStatus(threadConversation?.status || selectedConversation.status)}
                </span>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-3 text-sm text-[var(--text-soft)]">
                  <p>Business: {threadBusiness?.name || scopedBusinessName}</p>
                  <p>Type: {threadBusiness?.business_type || scopedBusinessType || "business"}</p>
                </div>
                <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-3 text-sm text-[var(--text-soft)]">
                  <p>Context: {getContextLabel(threadConversation || selectedConversation)}</p>
                  <p>
                    Contact:{" "}
                    {threadConversation?.client_email ||
                      selectedConversation.client_email ||
                      "No email"}
                    {threadConversation?.client_phone
                      ? ` | ${threadConversation.client_phone}`
                      : selectedConversation.client_phone
                        ? ` | ${selectedConversation.client_phone}`
                        : ""}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-[var(--text-muted)]">
                Last activity:{" "}
                {formatTimestamp(
                  threadConversation?.last_message_at ||
                    selectedConversation.last_message_at
                )}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(["open", "resolved", "archived"] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => handleStatusChange(status)}
                    className={`rounded-xl border px-3 py-1 text-xs font-medium transition ${
                      (threadConversation?.status || selectedConversation.status) === status
                        ? "border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--accent-soft)]"
                        : "border-[var(--border-soft)] bg-[var(--surface-raised)] text-[var(--text-soft)] hover:border-[var(--accent-border)]"
                    }`}
                  >
                    Mark {formatConversationStatus(status)}
                  </button>
                ))}
              </div>
            </div>

            <div
              ref={messagesViewportRef}
              className="mt-5 max-h-[60vh] space-y-3 overflow-y-auto rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] p-4"
            >
              {sortedMessages.length === 0 ? (
                <p className="text-sm text-[var(--text-soft)]">No messages yet.</p>
              ) : (
                sortedMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-xl px-4 py-3 ${
                      message.sender_type === "business"
                        ? "ml-auto max-w-[85%] border border-[var(--destructive-border)] bg-[var(--destructive-bg)]"
                        : "max-w-[85%] border border-[var(--border-soft)] bg-[var(--surface-raised)]"
                    }`}
                  >
                    <p className="text-sm leading-6 text-[var(--text-main)]">{message.body}</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="text-xs text-[var(--text-muted)]">
                        {formatTimestamp(message.created_at)}{" "}
                        {message.status === "pending"
                          ? "| Sending..."
                          : message.sender_type === "business"
                            ? message.read_at_client
                              ? "| Client read"
                              : "| Awaiting client read"
                            : message.read_at_business
                              ? "| Business read"
                              : "| Awaiting business reply"}
                      </p>
                      {message.sender_type === "business" &&
                      canUseAdvancedMessagingTools ? (
                        <button
                          type="button"
                          onClick={() => handleUnsend(message.id)}
                          disabled={unsendingMessageId === message.id}
                          className="text-xs font-medium text-[var(--accent-soft)] underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {unsendingMessageId === message.id ? "Unsending..." : "Unsend"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="mt-5 space-y-3">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Write a message for this client"
                className="input-field min-h-[140px]"
              />
                      <label className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(event) => setIsPrivate(event.target.checked)}
                  disabled={!canUseAdvancedMessagingTools}
                />
                Mark as private client access information
              </label>
              {!canUseAdvancedMessagingTools ? (
                <p className="text-xs text-[var(--text-muted)]">
                  Private notes and message unsend are available on Elite.
                </p>
              ) : null}
              {error ? (
                <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-[var(--text-muted)]">
                  Messages stay attached to this business-scoped thread for later retrieval.
                </p>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={loading || !draft.trim()}
                  className="btn-primary px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Sending..." : "Reply to customer"}
                </button>
              </div>
            </div>
          </>
        )}
      </DashboardPrimaryPanel>
    </DashboardGrid>
  );
}
