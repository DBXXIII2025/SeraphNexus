import Link from "next/link";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { getPlatformAdminSession } from "@/lib/platformAdmin";
import {
  getPlatformSupportConversationSummaries,
  getPlatformSupportMessages,
  markPlatformSupportRead,
} from "@/lib/platformSupport";
import { createAdminTranslator } from "@/lib/adminI18n";

export const dynamic = "force-dynamic";

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
  "active-business-required":
    "An active business is required before you can contact platform support.",
  "message-required": "Enter a message before sending your support request.",
  "send-failed": "The support message could not be sent.",
};

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const requestedConversationId = String(params?.conversation || "").trim();
  const { user, isPlatformAdmin } = await getPlatformAdminSession();

  if (!user) {
    return (
      <div className="surface-card p-6 text-[var(--text-main)]">
        <div className="empty-state">Sign in to contact platform support.</div>
      </div>
    );
  }

  if (isPlatformAdmin) {
    return (
      <div className="space-y-4 text-[var(--text-main)]">
        <section className="surface-card p-6">
          <p className="section-kicker">Support</p>
          <h1 className="section-title">Platform support</h1>
          <div className="mt-4 rounded-xl border border-[var(--border-soft)] bg-[rgba(15,12,12,0.52)] p-6 text-sm text-[var(--text-soft)]">
            The platform-owner account uses <Link href="/admin/messages" className="underline">/admin/messages</Link> for business-owner support threads and does not open tenant support requests.
          </div>
        </section>
      </div>
    );
  }

  const business = await getActiveBusiness();
  const t = createAdminTranslator(business?.language);

  if (!business) {
    return (
      <div className="space-y-4 text-[var(--text-main)]">
        <section className="surface-card p-6">
          <p className="section-kicker">{t("support")}</p>
          <h1 className="section-title">{t("support")}</h1>
          <div className="mt-4 empty-state">
            Select or create an active business before contacting platform support. Support requests
            must be tied to a real business context.
          </div>
        </section>
      </div>
    );
  }

  const conversations = await getPlatformSupportConversationSummaries({
    businessId: String(business.id),
    ownerUserId: user.id,
  });
  const selectedConversationId =
    requestedConversationId || (conversations[0]?.id ? String(conversations[0].id) : "");
  const thread = selectedConversationId
    ? await getPlatformSupportMessages(selectedConversationId)
    : { conversation: null, messages: [] };

  if (thread.conversation?.id && thread.conversation.ownerUserId === user.id) {
    await markPlatformSupportRead({
      conversationId: thread.conversation.id,
      reader: "business_owner",
      ownerUserId: user.id,
    });
  }

  const successMessage =
    params?.success === "sent" ? "Your support message was sent." : null;
  const errorMessage = params?.error ? ERROR_MESSAGES[String(params.error)] : null;

  return (
    <div className="space-y-6 text-[var(--text-main)]">
      <section className="premium-card p-6">
        <div className="section-header-copy">
          <p className="section-kicker">{t("support")}</p>
          <h1 className="section-title">{t("support")}</h1>
          <p className="section-description">
            Contact Seraph Nexus support for issues tied to {business.name}.
          </p>
        </div>
      </section>

      {successMessage ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {successMessage}
        </div>
      ) : null}
      {errorMessage ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[340px,1fr]">
        <section className="surface-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-kicker">{t("messages")}</p>
              <h2 className="mt-2 text-lg font-semibold text-[var(--text-strong)]">Business support inbox</h2>
            </div>
            <span className="status-chip">
              {conversations.length} threads
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {conversations.length === 0 ? (
              <div className="empty-state">No support threads yet. Send the first message below.</div>
            ) : (
              conversations.map((conversation) => (
                <Link
                  key={conversation.id}
                  href={`/admin/support?conversation=${encodeURIComponent(conversation.id)}`}
                  className={`block rounded-xl border p-4 ${
                    conversation.id === selectedConversationId
                      ? "border-[rgba(193,18,31,0.24)] bg-[rgba(193,18,31,0.1)]"
                      : "border-[var(--border-soft)] bg-[rgba(15,12,12,0.52)] hover:border-[rgba(212,175,55,0.16)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-[var(--text-strong)]">{conversation.subject || "Platform support"}</p>
                      <p className="mt-1 text-sm text-[var(--text-soft)]">
                        {conversation.lastMessageExcerpt || "No messages yet"}
                      </p>
                    </div>
                    <span className="status-chip">
                      {conversation.status === "awaiting_platform"
                        ? "Awaiting platform"
                        : conversation.status === "awaiting_business"
                          ? "Awaiting you"
                          : "Up to date"}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-[var(--text-muted)]">
                    {formatDateTime(conversation.lastMessageAt)}
                  </p>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="surface-card p-5">
          <div className="border-b border-[var(--border-soft)] pb-4">
            <p className="section-kicker">Support context</p>
            <h2 className="mt-2 text-lg font-semibold">
              {business.name} - {business.business_type || "business"}
            </h2>
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              Only authenticated business owners with an active business can use this support
              channel.
            </p>
          </div>

          {thread.conversation ? (
            <div className="mt-5 space-y-3">
              {thread.messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-xl px-4 py-3 ${
                    message.senderType === "business_owner"
                      ? "ml-auto max-w-[88%] border border-amber-500/20 bg-amber-500/10"
                      : "max-w-[88%] border border-[var(--border-soft)] bg-[rgba(15,12,12,0.52)]"
                  }`}
                >
                  <p className="text-sm leading-6">{message.body}</p>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    {formatDateTime(message.createdAt)} -{" "}
                    {message.senderType === "business_owner" ? "You" : "Platform support"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 empty-state">
              Start a support thread below. The thread will stay tied to {business.name}.
            </div>
          )}

          <form action="/api/platform-support/send" method="POST" className="mt-5 space-y-3">
            <input type="hidden" name="business_id" value={String(business.id)} />
            {thread.conversation?.id ? (
              <input type="hidden" name="conversation_id" value={thread.conversation.id} />
            ) : null}
            <textarea
              name="body"
              required
              placeholder="Describe the platform issue, question, or support request."
              className="input-field min-h-[150px]"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-[var(--text-muted)]">
                This support thread is scoped to {business.name} and visible only to you and the
                platform admin.
              </p>
              <button
                type="submit"
                className="btn-primary"
              >
                Send support message
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
