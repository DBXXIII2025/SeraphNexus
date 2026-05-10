import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { getPlatformAdminSession } from "@/lib/platformAdmin";
import {
  getPlatformSupportConversationSummaries,
  getPlatformSupportMessages,
  markPlatformSupportRead,
} from "@/lib/platformSupport";
import {
  getAdminConversationSummaries,
  getAuthorizedConversationForUser,
  getConversationMessages,
  markConversationReadForBusiness,
} from "@/lib/messages";
import { canAccessPlanFeature, getPlanDefinition, getPlanLimit } from "@/lib/planConfig";
import { createAdminTranslator } from "@/lib/adminI18n";
import AdminMessagesClient from "./AdminMessagesClient";
import {
  AdminPageContainer,
  DashboardGrid,
  DashboardPrimaryPanel,
  DashboardSecondaryPanel,
} from "@/components/admin/AdminLayoutSystem";

export const dynamic = "force-dynamic";

type SearchParams = {
  businessId?: string;
  conversation?: string;
  conversationId?: string;
  success?: string;
  error?: string;
};

function normalizeAdminMessage(
  value: Record<string, unknown>,
  clientUserId: string | null
): {
  id: string;
  sender_type: "business" | "client";
  body: string;
  created_at: string | null;
  read_at_business: string | null;
  read_at_client: string | null;
} {
  const senderUserId = value.sender_user_id ? String(value.sender_user_id) : null;
  const isBusinessSender =
    senderUserId !== null && senderUserId !== clientUserId;

  return {
    id: String(value.id || ""),
    sender_type: isBusinessSender ? "business" : "client",
    body: String(value.body || ""),
    created_at: value.created_at ? String(value.created_at) : null,
    read_at_business: !isBusinessSender && value.read_at ? String(value.read_at) : null,
    read_at_client: isBusinessSender && value.read_at ? String(value.read_at) : null,
  };
}

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

async function renderPlatformOwnerMessages(params: SearchParams | undefined) {
  const conversations = await getPlatformSupportConversationSummaries({});
  const requestedConversationId = String(
    params?.conversationId || params?.conversation || ""
  ).trim();
  const selectedConversationId =
    requestedConversationId || conversations[0]?.id || "";
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
    <AdminPageContainer className="text-[var(--text-main)]">
      <DashboardGrid className="xl:grid-cols-[360px,1fr]">
        <DashboardSecondaryPanel>
          <h1 className="text-xl font-semibold">Business-owner support inbox</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
            Platform support threads from tenant business owners only.
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
              <p className="text-sm text-[var(--text-soft)]">No support threads yet.</p>
            ) : (
              conversations.map((conversation) => (
                <Link
                  key={conversation.id}
                  href={`/admin/messages?conversationId=${encodeURIComponent(conversation.id)}`}
                  className={`block rounded-2xl border px-4 py-4 text-left transition ${
                    conversation.id === selectedConversationId
                      ? "border-[var(--destructive-border)] bg-[var(--destructive-bg)]"
                      : "border-[var(--border-soft)] bg-[var(--surface-raised)] hover:border-[var(--accent-border)]"
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
                    <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-raised)] px-2 py-1 text-xs text-[var(--text-soft)]">
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
                </Link>
              ))
            )}
          </div>
        </DashboardSecondaryPanel>

        <DashboardPrimaryPanel>
          {!selectedConversation || !thread.conversation ? (
            <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-raised)] p-6 text-sm text-[var(--text-soft)]">
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
                  <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-3 text-sm text-[var(--text-soft)]">
                    <p>Business type: {selectedConversation.businessType || "business"}</p>
                    <p>Business ID: {selectedConversation.businessId}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-3 text-sm text-[var(--text-soft)]">
                    <p>Owner email: {selectedConversation.ownerEmail || "Unknown"}</p>
                    <p>Owner phone: {selectedConversation.ownerPhone || "No phone"}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-[var(--text-muted)]">
                  Last activity: {formatDateTime(selectedConversation.lastMessageAt)}
                </p>
              </div>

              <div className="mt-5 space-y-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] p-4">
                {thread.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-xl px-4 py-3 ${
                      message.senderType === "platform_admin"
                        ? "ml-auto max-w-[88%] border border-[var(--destructive-border)] bg-[var(--destructive-bg)]"
                        : "max-w-[88%] border border-[var(--border-soft)] bg-[var(--surface-raised)]"
                    }`}
                  >
                    <p className="text-sm leading-6 text-[var(--text-main)]">{message.body}</p>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      {formatDateTime(message.createdAt)} - {message.senderType === "platform_admin" ? "Platform owner" : "Business owner"}
                    </p>
                  </div>
                ))}
              </div>

              <form
                action="/api/admin/messages/platform-support/reply"
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
        </DashboardPrimaryPanel>
      </DashboardGrid>
    </AdminPageContainer>
  );
}

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const requestedBusinessId = String(params?.businessId || "").trim();
  const requestedConversationId = String(
    params?.conversationId || params?.conversation || ""
  ).trim();
  const { user, isPlatformAdmin } = await getPlatformAdminSession();

  if (!user) {
    redirect("/login?next=%2Fadmin%2Fmessages");
  }

  if (isPlatformAdmin) {
    return renderPlatformOwnerMessages(params);
  }

  const activeBusiness = await getActiveBusiness(requestedBusinessId || undefined);
  const t = createAdminTranslator(activeBusiness?.language);

  if (!activeBusiness) {
    return (
      <AdminPageContainer className="text-[var(--text-main)]">
        <DashboardPrimaryPanel>
          <h1 className="text-xl font-semibold text-[var(--text-strong)]">{t("messages")}</h1>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            No active business is available for this account.
          </p>
        </DashboardPrimaryPanel>
      </AdminPageContainer>
    );
  }
  const scopedBusiness = activeBusiness;
  const messageThreadLimit = getPlanLimit(scopedBusiness.plan, "max_message_threads");

  if (!canAccessPlanFeature(scopedBusiness.plan, "full_messaging")) {
    const plan = getPlanDefinition(scopedBusiness.plan);

    return (
      <AdminPageContainer className="text-[var(--text-main)]">
        <DashboardPrimaryPanel>
          <p className="section-kicker">{t("messages")}</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">
            Customer inbox
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-soft)]">
            Customer conversations stay visible in the owner workspace, but replying and inbox
            operations require Pro or Elite. Your current plan is {plan.label}.
          </p>
          <Link
            href="/admin/upgrade"
            className="btn-primary mt-5 inline-flex px-4 py-2 text-sm font-medium"
          >
            {t("upgrade")}
          </Link>
        </DashboardPrimaryPanel>
      </AdminPageContainer>
    );
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[admin/messages/page] context", {
      activeBusinessId: activeBusiness.id,
      activeBusinessType: activeBusiness.business_type || null,
      selectedConversationId: requestedConversationId || null,
      scopedBusinessId: scopedBusiness.id,
      scopedBusinessType: scopedBusiness.business_type || null,
    });
  }

  const conversations = await getAdminConversationSummaries({
    businessId: scopedBusiness.id,
  });

  const selectedConversationId =
    requestedConversationId ||
    (conversations[0]?.id ? String(conversations[0].id) : null);

  const access = selectedConversationId
    ? await getAuthorizedConversationForUser({
        conversationId: selectedConversationId,
        userId: user.id,
        userEmail: user.email,
      })
    : null;

  const selectedConversationAccessible =
    Boolean(access?.role === "business" && access.business?.id === scopedBusiness.id);

  const effectiveSelectedConversationId = selectedConversationAccessible
    ? selectedConversationId
    : conversations[0]?.id || null;

  const effectiveAccess =
    effectiveSelectedConversationId && effectiveSelectedConversationId !== selectedConversationId
      ? await getAuthorizedConversationForUser({
          conversationId: effectiveSelectedConversationId,
          userId: user.id,
          userEmail: user.email,
        })
      : access;

  const { data: messages } =
    effectiveSelectedConversationId &&
    effectiveAccess?.role === "business" &&
    effectiveAccess.business?.id === scopedBusiness.id
      ? {
          data: await getConversationMessages({
            conversationId: effectiveSelectedConversationId,
            businessId: scopedBusiness.id,
          }),
        }
      : { data: [] as Array<Record<string, unknown>> };

  if (
    effectiveSelectedConversationId &&
    effectiveAccess?.role === "business" &&
    effectiveAccess.business?.id === scopedBusiness.id
  ) {
    await markConversationReadForBusiness(effectiveSelectedConversationId);
  }

  return (
    <AdminPageContainer className="text-[var(--text-main)]">
      {messageThreadLimit !== null ? (
        <DashboardPrimaryPanel>
          <p className="section-kicker">{t("messages")}</p>
          <h2 className="mt-2 text-lg font-semibold text-[var(--text-strong)]">
            Trial inbox is capped at {messageThreadLimit} message threads
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">
            Upgrade to Pro for unlimited messaging volume, or Elite for advanced private and
            moderation tools.
          </p>
          <Link href="/admin/upgrade" className="btn-secondary mt-4 inline-flex px-4 py-2 text-sm font-medium">
            {t("upgrade")}
          </Link>
        </DashboardPrimaryPanel>
      ) : null}

        <AdminMessagesClient
        businessId={scopedBusiness.id}
        activeBusinessId={activeBusiness.id}
        activeBusinessName={activeBusiness.name || "Business"}
        activeBusinessType={activeBusiness.business_type || null}
        scopedBusinessId={scopedBusiness.id}
        scopedBusinessName={scopedBusiness.name || "Business"}
        scopedBusinessType={scopedBusiness.business_type || null}
        canUseAdvancedMessagingTools={canAccessPlanFeature(
          scopedBusiness.plan,
          "advanced_messaging"
        )}
        initialConversations={conversations}
        initialSelectedConversationId={effectiveSelectedConversationId}
        initialMessages={(messages || []).map((message: Record<string, unknown>) =>
          normalizeAdminMessage(
            message,
            effectiveAccess?.conversation?.client_user_id || null
          )
        )}
      />
    </AdminPageContainer>
  );
}
