"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AssistantActionRecord,
  AssistantBusinessOption,
  AssistantConversationRecord,
  AssistantContextSummary,
  AssistantMemorySummaryRecord,
  AssistantMessageRecord,
} from "@/lib/assistant";

type AssistantChatProps = {
  businessId: string;
  businessName: string;
  contextSummary: AssistantContextSummary;
  conversations: AssistantConversationRecord[];
  selectedConversation: AssistantConversationRecord | null;
  initialMessages: AssistantMessageRecord[];
  initialActions: AssistantActionRecord[];
  initialMemories: AssistantMemorySummaryRecord[];
  initialError: string | null;
  initialActionError: string | null;
  initialNotice: string | null;
  isPlatformAdmin: boolean;
  businessOptions: AssistantBusinessOption[];
  selectedBusinessId: string;
};

type ActionMutationState = {
  isLoading: boolean;
  error: string | null;
};

function formatTimestamp(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function formatConversationStamp(conversation: AssistantConversationRecord) {
  return formatTimestamp(conversation.last_message_at || conversation.updated_at);
}

function formatActionLabel(value: string) {
  return value
    .replace(/^draft_/, "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildConversationTag(conversationId: string) {
  return `SRV-${conversationId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

function buildConversationTitle(conversation: AssistantConversationRecord) {
  if (conversation.title?.trim()) {
    return conversation.title.trim();
  }

  return conversation.status === "active"
    ? "Current Seravelle conversation"
    : "Earlier Seravelle discussion";
}

function mergeMessages(current: AssistantMessageRecord[], next: AssistantMessageRecord[]) {
  const merged = new Map<string, AssistantMessageRecord>();

  [...current, ...next].forEach((message) => {
    if (!message.id) {
      return;
    }

    const existing = merged.get(message.id);
    merged.set(message.id, existing ? { ...existing, ...message } : message);
  });

  return Array.from(merged.values()).sort(
    (left, right) =>
      new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  );
}

function mergeActions(current: AssistantActionRecord[], next: AssistantActionRecord[]) {
  const merged = new Map<string, AssistantActionRecord>();

  [...current, ...next].forEach((action) => {
    if (!action.id) {
      return;
    }

    const existing = merged.get(action.id);
    merged.set(action.id, existing ? { ...existing, ...action } : action);
  });

  return Array.from(merged.values()).sort(
    (left, right) =>
      new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  );
}

function newestMessageTime(messages: AssistantMessageRecord[]) {
  return messages.reduce<string | null>((latest, message) => {
    const current = String(message.created_at || "");
    if (!current) {
      return latest;
    }
    if (!latest) {
      return current;
    }
    return new Date(current).getTime() > new Date(latest).getTime() ? current : latest;
  }, null);
}

function parsedPreviewFromMessages(
  messages: AssistantMessageRecord[],
  fallback: string
) {
  const latestAssistant = [...messages]
    .reverse()
    .find((message) => message.role === "assistant" && message.content.trim());

  return latestAssistant?.content?.trim() || fallback;
}

function actionSummary(action: AssistantActionRecord) {
  const summary =
    action.payload && typeof action.payload === "object" && "summary" in action.payload
      ? String(action.payload.summary || "").trim()
      : "";

  return summary || "Review this Seravelle draft before deciding whether to run it.";
}

function actionConversationTag(action: AssistantActionRecord) {
  if (
    action.action_type !== "draft_client_reply" ||
    !action.payload ||
    typeof action.payload !== "object" ||
    !("conversationTag" in action.payload)
  ) {
    return null;
  }

  const value = String(action.payload.conversationTag || "").trim();
  return value || null;
}

function statusLabel(status: AssistantConversationRecord["status"]) {
  if (status === "cleared") {
    return "Cleared";
  }
  if (status === "archived") {
    return "Archived";
  }
  return "Active";
}

export default function AssistantChat({
  businessId,
  businessName,
  contextSummary,
  conversations,
  selectedConversation,
  initialMessages,
  initialActions,
  initialMemories,
  initialError,
  initialActionError,
  initialNotice,
  isPlatformAdmin,
  businessOptions,
  selectedBusinessId,
}: AssistantChatProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<AssistantMessageRecord[]>(
    initialMessages.map((message) => ({
      ...message,
      status: message.status || "sent",
    }))
  );
  const [conversationItems, setConversationItems] = useState<AssistantConversationRecord[]>(
    conversations
  );
  const [actions, setActions] = useState<AssistantActionRecord[]>(initialActions);
  const [memories, setMemories] = useState<AssistantMemorySummaryRecord[]>(initialMemories);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState(initialError);
  const [actionError, setActionError] = useState(initialActionError);
  const [notice, setNotice] = useState(initialNotice);
  const [isLoading, setIsLoading] = useState(false);
  const [isConversationMutating, setIsConversationMutating] = useState(false);
  const [businessSelection, setBusinessSelection] = useState(selectedBusinessId);
  const [actionMutations, setActionMutations] = useState<Record<string, ActionMutationState>>({});
  const [forgettingMemoryId, setForgettingMemoryId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

  const selectedConversationId = selectedConversation?.id || "";
  const isActiveConversation = selectedConversation?.status === "active";

  useEffect(() => {
    setMessages(
      initialMessages.map((message) => ({
        ...message,
        status: message.status || "sent",
      }))
    );
    setActions(initialActions);
    setMemories(initialMemories);
    setConversationItems(conversations);
    setError(initialError);
    setActionError(initialActionError);
    setNotice(initialNotice);
    setBusinessSelection(selectedBusinessId);
    setActionMutations({});
    setIsConversationMutating(false);
  }, [
    initialMessages,
    initialActions,
    initialMemories,
    conversations,
    initialError,
    initialActionError,
    initialNotice,
    selectedBusinessId,
    businessId,
  ]);

  useEffect(() => {
    if (!stickToBottomRef.current) {
      return;
    }

    const element = messagesViewportRef.current;
    if (!element) {
      return;
    }

    element.scrollTo({
      top: element.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, actions, isLoading]);

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
      const element = messagesViewportRef.current;
      if (!element) {
        return;
      }

      element.scrollTo({
        top: element.scrollHeight,
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [selectedConversationId]);

  function buildAssistantHref(nextConversationId?: string, nextNotice?: string | null) {
    const params = new URLSearchParams();
    params.set("businessId", businessId);
    if (nextConversationId) {
      params.set("conversationId", nextConversationId);
    }
    if (nextNotice) {
      params.set("notice", nextNotice);
    }
    return `/admin/assistant?${params.toString()}`;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || isLoading || !selectedConversationId || !isActiveConversation) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setNotice(null);
    setActionError(initialActionError);
    setPrompt("");
    stickToBottomRef.current = true;

    const requestId = `local-${Date.now()}`;
    const optimisticUserMessage: AssistantMessageRecord = {
      id: `${requestId}-user`,
      assistant_conversation_id: selectedConversationId,
      role: "user",
      content: trimmedPrompt,
      created_at: new Date().toISOString(),
      status: "pending",
    };

    setMessages((current) => mergeMessages(current, [optimisticUserMessage]));
    setConversationItems((current) =>
      current.map((conversation) =>
        conversation.id === selectedConversationId
          ? {
              ...conversation,
              title: conversation.title || trimmedPrompt.slice(0, 72),
              latestPreview: trimmedPrompt,
              last_message_at: optimisticUserMessage.created_at,
              updated_at: optimisticUserMessage.created_at,
            }
          : conversation
      )
    );

    try {
      const response = await fetch("/api/admin/assistant/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId,
          conversationId: selectedConversationId,
          message: trimmedPrompt,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        reply?: string;
        messages?: AssistantMessageRecord[];
        action?: AssistantActionRecord | null;
        actionError?: string | null;
      };

      if (!response.ok || !data.reply || !Array.isArray(data.messages) || data.messages.length === 0) {
        throw new Error(data.error || "Seravelle could not answer right now.");
      }

      setMessages((current) => {
        const withoutOptimistic = current.filter((entry) => entry.id !== optimisticUserMessage.id);
        const savedMessages = data.messages!.map((message) => ({
          ...message,
          status: "sent" as const,
        }));
        return mergeMessages(withoutOptimistic, savedMessages);
      });
      setConversationItems((current) =>
        current.map((conversation) =>
          conversation.id === selectedConversationId
            ? {
                ...conversation,
                title: conversation.title || trimmedPrompt.slice(0, 72),
                latestPreview: parsedPreviewFromMessages(data.messages!, trimmedPrompt),
                last_message_at: newestMessageTime(data.messages!) || conversation.last_message_at,
                updated_at: newestMessageTime(data.messages!) || conversation.updated_at,
              }
            : conversation
        )
      );

      if (data.action?.id) {
        setActions((current) => mergeActions(current, [data.action!]));
      }
      setActionError(data.actionError || initialActionError);
    } catch (submitError) {
      setMessages((current) =>
        current.map((entry) =>
          entry.id === optimisticUserMessage.id
            ? {
                ...entry,
                status: "failed",
              }
            : entry
        )
      );
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Seravelle could not answer right now."
      );
      setPrompt(trimmedPrompt);
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  }

  async function handleActionDecision(actionId: string, decision: "approve" | "reject") {
    setError(null);
    setActionMutations((current) => ({
      ...current,
      [actionId]: {
        isLoading: true,
        error: null,
      },
    }));

    try {
      const response = await fetch(
        `/api/admin/assistant/actions/${encodeURIComponent(actionId)}/${decision}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ businessId }),
        }
      );

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        action?: AssistantActionRecord;
      };

      if (data.action?.id) {
        setActions((current) => mergeActions(current, [data.action!]));
      }

      if (!response.ok || !data.action) {
        throw new Error(data.error || `The assistant action could not be ${decision}d.`);
      }

      setActionMutations((current) => ({
        ...current,
        [actionId]: {
          isLoading: false,
          error: null,
        },
      }));
    } catch (decisionError) {
      setActionMutations((current) => ({
        ...current,
        [actionId]: {
          isLoading: false,
          error:
            decisionError instanceof Error
              ? decisionError.message
              : `The assistant action could not be ${decision}d.`,
        },
      }));
    }
  }

  async function handleConversationMutation(action: "new" | "clear") {
    if (isConversationMutating) {
      return;
    }

    setIsConversationMutating(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/assistant/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId,
          currentConversationId: selectedConversationId || null,
          action,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        notice?: string | null;
        conversation?: {
          id?: string;
        } | null;
      };

      if (!response.ok || !data.conversation?.id) {
        throw new Error(data.error || "Seravelle conversation could not be updated.");
      }

      startTransition(() => {
        router.replace(
          buildAssistantHref(
            data.conversation?.id,
            action === "clear" ? "cleared" : "new"
          ),
          { scroll: false }
        );
      });
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Seravelle conversation could not be updated."
      );
      setIsConversationMutating(false);
    }
  }

  function handleBusinessChange() {
    if (!businessSelection || businessSelection === selectedBusinessId) {
      return;
    }

    startTransition(() => {
      router.replace(`/admin/assistant?businessId=${encodeURIComponent(businessSelection)}`, {
        scroll: false,
      });
    });
  }

  async function handleForgetMemory(memoryId: string) {
    if (forgettingMemoryId) {
      return;
    }

    setForgettingMemoryId(memoryId);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/assistant/memory/${encodeURIComponent(memoryId)}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ businessId }),
        }
      );

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Seravelle memory could not be removed.");
      }

      setMemories((current) => current.filter((memory) => memory.id !== memoryId));
    } catch (forgetError) {
      setError(
        forgetError instanceof Error
          ? forgetError.message
          : "Seravelle memory could not be removed."
      );
    } finally {
      setForgettingMemoryId(null);
    }
  }

  return (
    <div className="grid min-h-[720px] xl:grid-cols-[280px,1fr]">
      <aside className="border-b border-[var(--border-soft)] bg-[var(--surface-raised)] xl:border-b-0 xl:border-r">
        <div className="border-b border-[var(--border-soft)] px-4 py-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Seravelle
          </p>
          <h2 className="mt-2 text-lg font-semibold text-[var(--text-strong)]">
            Conversations
          </h2>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            Keep current work active while archived threads stay available for recall.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => handleConversationMutation("new")}
              disabled={isConversationMutating}
              className="btn-secondary flex-1 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isConversationMutating ? "Working..." : "New Conversation"}
            </button>
            <button
              type="button"
              onClick={() => handleConversationMutation("clear")}
              disabled={isConversationMutating || !selectedConversationId}
              className="btn-secondary flex-1 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            >
              Clear Conversation
            </button>
          </div>
        </div>

        <div className="max-h-[260px] overflow-y-auto px-3 py-3 xl:max-h-[calc(720px-118px)]">
          <div className="space-y-2">
            {conversationItems.map((conversation) => {
              const isSelected = conversation.id === selectedConversationId;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() =>
                    startTransition(() => {
                      router.replace(buildAssistantHref(conversation.id), {
                        scroll: false,
                      });
                    })
                  }
                  className={
                    isSelected
                      ? "w-full rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-muted)] p-3 text-left"
                      : "w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-3 text-left transition hover:border-[var(--accent-border)] hover:bg-[var(--surface-raised)]"
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        {buildConversationTag(conversation.id)}
                      </p>
                      <h3 className="mt-2 text-sm font-semibold text-[var(--text-strong)]">
                        {buildConversationTitle(conversation)}
                      </h3>
                    </div>
                    <span className="rounded-full border border-[var(--border-soft)] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      {statusLabel(conversation.status)}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-xs leading-5 text-[var(--text-soft)]">
                    {conversation.latestPreview || "No saved preview yet."}
                  </p>
                  <p className="mt-3 text-[11px] text-[var(--text-muted)]">
                    {formatConversationStamp(conversation)}
                  </p>
                </button>
              );
            })}
          </div>
          <div className="mt-5 space-y-2 border-t border-[var(--border-soft)] pt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Memory Seravelle Knows
              </p>
              <span className="text-[11px] text-[var(--text-muted)]">{memories.length}</span>
            </div>
            {memories.length === 0 ? (
              <p className="text-xs leading-5 text-[var(--text-soft)]">
                Seravelle will build business-scoped memory summaries from your conversations
                and approved patterns.
              </p>
            ) : (
              memories.map((memory) => (
                <div
                  key={memory.id}
                  className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        {memory.conversationStatus}
                      </p>
                      <p className="mt-1 text-sm font-medium text-[var(--text-strong)]">
                        {memory.conversationTitle}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleForgetMemory(memory.id)}
                      disabled={forgettingMemoryId === memory.id}
                      className="text-[11px] uppercase tracking-[0.18em] text-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {forgettingMemoryId === memory.id ? "Forgetting..." : "Forget"}
                    </button>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--text-soft)]">
                    {memory.summary}
                  </p>
                  {memory.topics.length > 0 ? (
                    <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                      Topics: {memory.topics.join(", ")}
                    </p>
                  ) : null}
                  <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                    {formatTimestamp(memory.updatedAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      <div className="flex min-h-[720px] flex-col">
        <div className="border-b border-[var(--border-soft)] bg-[var(--surface-raised)] px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Seravelle
              </p>
              <h2 className="mt-2 text-lg font-semibold text-[var(--text-strong)]">
                {businessName}
              </h2>
              <p className="mt-1 text-sm text-[var(--text-soft)]">
                Warm, concise business intelligence for this workspace.
              </p>
              {selectedConversation ? (
                <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {buildConversationTag(selectedConversation.id)} |{" "}
                  {statusLabel(selectedConversation.status)}
                </p>
              ) : null}
              <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[var(--accent-soft)]">
                {contextSummary.businessType}
                {contextSummary.serviceCategory ? ` | ${contextSummary.serviceCategory}` : ""}
                {` | ${contextSummary.effectivePlan} plan`}
              </p>
            </div>

            {isPlatformAdmin && businessOptions.length > 0 ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  value={businessSelection}
                  onChange={(event) => setBusinessSelection(event.target.value)}
                  className="input-field min-w-[220px]"
                >
                  {businessOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name} | {option.plan}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleBusinessChange}
                  className="btn-secondary px-4 py-2 text-sm font-medium"
                >
                  Switch workspace
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div
          ref={messagesViewportRef}
          className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(212,175,55,0.04),transparent_18%),var(--surface)] px-4 py-4 sm:px-5"
        >
          {notice ? (
            <div className="mb-4 rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-muted)] px-4 py-3 text-sm text-[var(--accent-soft)]">
              {notice}
            </div>
          ) : null}

          {!isActiveConversation && selectedConversation ? (
            <div className="mb-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-3 text-sm text-[var(--text-soft)]">
              This Seravelle thread is {selectedConversation.status}. It remains available for
              history and memory recall, but new messages should continue in an active
              conversation.
            </div>
          ) : null}

          {messages.length === 0 && actions.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="max-w-xl rounded-3xl border border-dashed border-[var(--accent-border)] bg-[var(--accent-muted)] px-6 py-8 text-center">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent-soft)]">
                  Welcome to Seravelle
                </p>
                <h3 className="mt-3 text-xl font-semibold text-[var(--text-strong)]">
                  Hello, I am Seravelle.
                </h3>
                <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">
                  I help you understand workspace health, remember operating preferences, suggest
                  next steps, and prepare approval-based drafts.
                </p>
                <div className="mt-5 space-y-2 text-left text-sm leading-6 text-[var(--text-soft)]">
                  <p>- Summarize today&apos;s business snapshot</p>
                  <p>- Recall saved business preferences when relevant</p>
                  <p>- Recommend next actions to stay organized and grow</p>
                  <p>- Draft replies, offers, and records for approval</p>
                  <p>- Keep everything business-scoped and non-destructive</p>
                </div>
                <p className="mt-5 text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Powered by Gemini
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={
                    message.role === "assistant"
                      ? "mr-auto max-w-[92%] rounded-[1.6rem] border border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-4 sm:max-w-[84%]"
                      : "ml-auto max-w-[92%] rounded-[1.6rem] border border-[var(--accent-border)] bg-[var(--accent-muted)] px-4 py-4 sm:max-w-[78%]"
                  }
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      {message.role === "assistant" ? "Seravelle" : "You"}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {formatTimestamp(message.created_at)}
                    </p>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--text-main)]">
                    {message.content}
                  </p>
                  {message.role === "user" && message.status === "failed" ? (
                    <p className="mt-3 text-xs text-red-200">Send failed. Edit or retry.</p>
                  ) : null}
                  {message.role === "user" && message.status === "pending" ? (
                    <p className="mt-3 text-xs text-[var(--text-muted)]">Sending...</p>
                  ) : null}
                </div>
              ))}

              {actions.map((action) => {
                const mutation = actionMutations[action.id];
                const isPendingDecision = mutation?.isLoading === true;
                const canDecide = action.status === "draft" && !isPendingDecision;
                const conversationTag = actionConversationTag(action);

                return (
                  <div
                    key={action.id}
                    className="mr-auto max-w-[92%] rounded-[1.8rem] border border-[var(--accent-border)] bg-[linear-gradient(180deg,rgba(212,175,55,0.12),rgba(15,15,15,0.96))] px-4 py-4 sm:max-w-[88%]"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent-soft)]">
                          Seravelle Draft
                        </p>
                        <h3 className="mt-2 text-base font-semibold text-[var(--text-strong)]">
                          {formatActionLabel(action.action_type)}
                        </h3>
                        {conversationTag ? (
                          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--accent-soft)]">
                            {conversationTag}
                          </p>
                        ) : null}
                        <p className="mt-2 text-sm text-[var(--text-soft)]">
                          {actionSummary(action)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                          {action.status}
                        </p>
                        <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                          {formatTimestamp(action.updated_at || action.created_at)}
                        </p>
                      </div>
                    </div>

                    <pre className="mt-4 overflow-x-auto rounded-2xl border border-[var(--border-soft)] bg-black/20 p-3 text-xs leading-5 text-[var(--text-soft)]">
                      {JSON.stringify(action.payload, null, 2)}
                    </pre>

                    {action.result && Object.keys(action.result).length > 0 ? (
                      <pre className="mt-3 overflow-x-auto rounded-2xl border border-[var(--border-soft)] bg-black/10 p-3 text-xs leading-5 text-[var(--text-soft)]">
                        {JSON.stringify(action.result, null, 2)}
                      </pre>
                    ) : null}

                    {mutation?.error ? (
                      <p className="mt-3 text-sm text-red-200">{mutation.error}</p>
                    ) : null}

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-[var(--text-muted)]">
                        Review first. Seravelle cannot execute anything until you approve it.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleActionDecision(action.id, "reject")}
                          disabled={!canDecide}
                          className="btn-secondary px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isPendingDecision ? "Working..." : "Reject"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleActionDecision(action.id, "approve")}
                          disabled={!canDecide}
                          className="btn-primary px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isPendingDecision ? "Working..." : "Approve"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {isLoading ? (
                <div className="mr-auto max-w-[84%] rounded-[1.6rem] border border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Seravelle
                  </p>
                  <p className="mt-3 text-sm text-[var(--text-soft)]">
                    Reviewing workspace context and preparing a response or approval-ready draft...
                  </p>
                </div>
              ) : null}
              <div ref={scrollRef} />
            </div>
          )}
        </div>

        <div className="border-t border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-4 sm:px-5">
          {actionError ? (
            <div className="mb-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {actionError}
            </div>
          ) : null}

          {error ? (
            <div className="mb-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-3">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Ask Seravelle for guidance or have her draft a reply, service, product, menu item, promo code, or booking summary for approval."
              className="input-field min-h-[132px] resize-y"
              maxLength={4000}
              disabled={isLoading || Boolean(initialError) || !isActiveConversation}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[var(--text-muted)]">
                {isActiveConversation
                  ? "Draft, review, approve, execute. Restricted actions remain blocked."
                  : "Archived conversations stay available for reference. Start a fresh active conversation to continue."}
              </p>
              <button
                type="submit"
                disabled={
                  isLoading ||
                  !prompt.trim() ||
                  Boolean(initialError) ||
                  !isActiveConversation
                }
                className="btn-primary px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "Drafting..." : "Ask Seravelle"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
