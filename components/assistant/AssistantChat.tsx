"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AssistantActionRecord,
  AssistantBusinessOption,
  AssistantMessageRecord,
} from "@/lib/assistant";

type AssistantChatProps = {
  businessId: string;
  businessName: string;
  initialMessages: AssistantMessageRecord[];
  initialActions: AssistantActionRecord[];
  initialError: string | null;
  initialActionError: string | null;
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

function formatActionLabel(value: string) {
  return value
    .replace(/^draft_/, "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

function actionSummary(action: AssistantActionRecord) {
  const summary =
    action.payload && typeof action.payload === "object" && "summary" in action.payload
      ? String(action.payload.summary || "").trim()
      : "";

  return summary || "Review this drafted assistant action before deciding whether to run it.";
}

export default function AssistantChat({
  businessId,
  businessName,
  initialMessages,
  initialActions,
  initialError,
  initialActionError,
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
  const [actions, setActions] = useState<AssistantActionRecord[]>(initialActions);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState(initialError);
  const [actionError, setActionError] = useState(initialActionError);
  const [isLoading, setIsLoading] = useState(false);
  const [businessSelection, setBusinessSelection] = useState(selectedBusinessId);
  const [actionMutations, setActionMutations] = useState<Record<string, ActionMutationState>>({});
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages(
      initialMessages.map((message) => ({
        ...message,
        status: message.status || "sent",
      }))
    );
    setActions(initialActions);
    setError(initialError);
    setActionError(initialActionError);
    setBusinessSelection(selectedBusinessId);
    setActionMutations({});
  }, [initialMessages, initialActions, initialError, initialActionError, selectedBusinessId, businessId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, actions, isLoading]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setActionError(initialActionError);
    setPrompt("");

    const requestId = `local-${Date.now()}`;
    const optimisticUserMessage: AssistantMessageRecord = {
      id: `${requestId}-user`,
      role: "user",
      content: trimmedPrompt,
      created_at: new Date().toISOString(),
      status: "pending",
    };

    setMessages((current) => mergeMessages(current, [optimisticUserMessage]));

    try {
      const response = await fetch("/api/admin/assistant/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId,
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
        throw new Error(data.error || "The AI assistant could not answer right now.");
      }

      setMessages((current) => {
        const withoutOptimistic = current.filter((entry) => entry.id !== optimisticUserMessage.id);
        const savedMessages = data.messages!.map((message) => ({
          ...message,
          status: "sent" as const,
        }));
        return mergeMessages(withoutOptimistic, savedMessages);
      });

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
          : "The AI assistant could not answer right now."
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
      const response = await fetch(`/api/admin/assistant/actions/${encodeURIComponent(actionId)}/${decision}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ businessId }),
      });

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

  function handleBusinessChange() {
    if (!businessSelection || businessSelection === selectedBusinessId) {
      return;
    }

    startTransition(() => {
      router.replace(`/admin/assistant?businessId=${encodeURIComponent(businessSelection)}`);
    });
  }

  return (
    <div className="grid min-h-[680px] xl:grid-cols-[1fr]">
      <div className="flex min-h-[680px] flex-col">
        <div className="border-b border-[var(--border-soft)] bg-[var(--surface-raised)] px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Assistant Console
              </p>
              <h2 className="mt-2 text-lg font-semibold text-[var(--text-strong)]">
                {businessName}
              </h2>
              <p className="mt-1 text-sm text-[var(--text-soft)]">
                Approval-based guidance and action drafting for Seraph Nexus workflows.
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
                  Switch context
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(212,175,55,0.04),transparent_18%),var(--surface)] px-4 py-4 sm:px-5">
          {messages.length === 0 && actions.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="max-w-xl rounded-3xl border border-dashed border-[var(--accent-border)] bg-[var(--accent-muted)] px-6 py-8 text-center">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent-soft)]">
                  Empty Session
                </p>
                <h3 className="mt-3 text-xl font-semibold text-[var(--text-strong)]">
                  Ask about this business workspace
                </h3>
                <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">
                  Ask for operational advice or have the assistant draft a reply, service,
                  product, promo code, or booking summary for review.
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
                      {message.role === "assistant" ? "AI Assistant" : "You"}
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

                return (
                  <div
                    key={action.id}
                    className="mr-auto max-w-[92%] rounded-[1.8rem] border border-[var(--accent-border)] bg-[linear-gradient(180deg,rgba(212,175,55,0.12),rgba(15,15,15,0.96))] px-4 py-4 sm:max-w-[88%]"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent-soft)]">
                          Draft Action
                        </p>
                        <h3 className="mt-2 text-base font-semibold text-[var(--text-strong)]">
                          {formatActionLabel(action.action_type)}
                        </h3>
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
                        Review first. The assistant cannot execute anything until you approve it.
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
                    AI Assistant
                  </p>
                  <p className="mt-3 text-sm text-[var(--text-soft)]">
                    Analyzing workspace context and drafting a response or approval-ready action...
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
              placeholder="Ask for guidance or have the assistant draft a reply, service, product, promo code, or booking summary for approval."
              className="input-field min-h-[132px] resize-y"
              maxLength={4000}
              disabled={isLoading || Boolean(initialError)}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[var(--text-muted)]">
                Draft, review, approve, execute. Restricted actions stay blocked.
              </p>
              <button
                type="submit"
                disabled={isLoading || !prompt.trim() || Boolean(initialError)}
                className="btn-primary px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "Drafting..." : "Ask AI Assistant"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
