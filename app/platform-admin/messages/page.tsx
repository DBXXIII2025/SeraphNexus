import {
  getPlatformSupportConversationSummaries,
  getPlatformSupportMessages,
  markPlatformSupportRead,
} from "@/lib/platformSupport";

type SearchParams = {
  conversation?: string;
  success?: string;
  error?: string;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "No activity yet";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

const ERROR_MESSAGES: Record<string, string> = {
  "message-required": "Enter a reply before sending.",
  "thread-not-found": "The support thread could not be found.",
  "send-failed": "The support reply could not be sent.",
};

export default async function PlatformAdminMessagesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const conversations = await getPlatformSupportConversationSummaries({});
  const selectedConversationId =
    String(params?.conversation || "").trim() || conversations[0]?.id || "";
  const selectedConversation = conversations.find(
    (conversation) => conversation.id === selectedConversationId
  );
  const thread = selectedConversationId
    ? await getPlatformSupportMessages(selectedConversationId)
    : { conversation: null, messages: [] };

  if (thread.conversation?.id) {
    await markPlatformSupportRead({
      conversationId: thread.conversation.id,
      reader: "platform",
      ownerUserId: thread.conversation.ownerUserId,
    });
  }

  const successMessage =
    params?.success === "sent" ? "Support reply sent." : null;
  const errorMessage = params?.error ? ERROR_MESSAGES[String(params.error)] : null;

  return (
    <div className="grid gap-6 text-[var(--text-main)] lg:grid-cols-[360px,1fr]">
      <div className="premium-card p-6">
        <p className="section-kicker">Support</p>
        <h1 className="section-title">Platform support inbox</h1>
        <p className="section-description">
          Business-owner support threads across the entire platform.
        </p>

        {successMessage ? (
          <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {successMessage}
          </div>
        ) : null}
        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-5 space-y-3">
          {conversations.length === 0 ? (
            <div className="empty-state">No support threads yet.</div>
          ) : (
            conversations.map((conversation) => (
              <a
                key={conversation.id}
                href={`/platform-admin/messages?conversation=${encodeURIComponent(conversation.id)}`}
                className={`block rounded-2xl border px-4 py-4 text-left transition ${
                  conversation.id === selectedConversationId
                    ? "border-[rgba(193,18,31,0.24)] bg-[rgba(193,18,31,0.1)]"
                    : "border-[var(--border-soft)] bg-[rgba(15,12,12,0.52)] hover:border-[rgba(212,175,55,0.16)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{conversation.businessName || "Business"}</p>
                    <p className="mt-1 text-sm text-[var(--text-soft)]">
                      {conversation.ownerEmail || "Owner"} - {conversation.businessType || "business"}
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      {conversation.lastMessageExcerpt || "No messages yet"}
                    </p>
                  </div>
                  <span className="status-chip">
                    {conversation.unreadForPlatform > 0
                      ? `${conversation.unreadForPlatform} unread`
                      : conversation.status === "awaiting_business"
                        ? "Awaiting owner"
                        : "Up to date"}
                  </span>
                </div>
                <p className="mt-3 text-xs text-[var(--text-muted)]">
                  {formatDateTime(conversation.lastMessageAt)}
                </p>
              </a>
            ))
          )}
        </div>
      </div>

      <div className="surface-card p-6">
        {!selectedConversation || !thread.conversation ? (
          <div className="empty-state">
            Select a support thread to view business context and reply.
          </div>
        ) : (
          <>
            <div className="border-b border-[var(--border-soft)] pb-4">
              <h2 className="text-lg font-semibold">
                {selectedConversation.businessName || "Business"}
              </h2>
              <p className="mt-1 text-sm text-[var(--text-soft)]">
                Owner: {selectedConversation.ownerName || selectedConversation.ownerEmail || "Unknown"}
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="form-section px-4 py-3 text-sm text-[var(--text-soft)]">
                  <p>Business type: {selectedConversation.businessType || "business"}</p>
                  <p>Business ID: {selectedConversation.businessId}</p>
                </div>
                <div className="form-section px-4 py-3 text-sm text-[var(--text-soft)]">
                  <p>Owner email: {selectedConversation.ownerEmail || "Unknown"}</p>
                  <p>Owner phone: {selectedConversation.ownerPhone || "No phone"}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-[var(--text-muted)]">
                Last activity: {formatDateTime(selectedConversation.lastMessageAt)}
              </p>
            </div>

            <div className="mt-5 space-y-3 rounded-2xl border border-[var(--border-soft)] bg-[rgba(15,12,12,0.74)] p-4">
              {thread.messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-xl px-4 py-3 ${
                    message.senderType === "platform_admin"
                      ? "ml-auto max-w-[88%] border border-[rgba(193,18,31,0.24)] bg-[rgba(193,18,31,0.14)]"
                      : "max-w-[88%] border border-[var(--border-soft)] bg-[rgba(31,25,25,0.92)]"
                  }`}
                >
                  <p className="text-sm leading-6 text-[var(--text-main)]">{message.body}</p>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    {formatDateTime(message.createdAt)} -{" "}
                    {message.senderType === "platform_admin" ? "Platform admin" : "Business owner"}
                  </p>
                </div>
              ))}
            </div>

            <form
              action="/api/platform-admin/messages/send"
              method="POST"
              className="mt-5 space-y-3"
            >
              <input type="hidden" name="conversation_id" value={selectedConversation.id} />
              <textarea
                name="body"
                required
                placeholder="Reply to the business owner."
                className="input-field min-h-[140px]"
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-[var(--text-muted)]">
                  Replies stay tied to this business-scoped platform support thread.
                </p>
                <button
                  type="submit"
                  className="btn-primary px-4 py-2 text-sm font-medium"
                >
                  Reply to business owner
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
