import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  filterMessagesForRole,
  findConversationForClientBusiness,
  getAuthorizedConversationForUser,
  getConversationByAccessToken,
  getConversationMessages,
  markConversationReadForClient,
} from "@/lib/messages";
import { getGuestConversationCookieName } from "@/lib/messageThreadCookies";
import BusinessConversationClient from "./business/[conversationId]/BusinessConversationClient";
import PublicMessagesClient from "./PublicMessagesClient";

type MessagesSearchParams = {
  businessId?: string;
  conversationId?: string;
  source?: string;
};

type InitialMessageRecord = {
  id: string;
  sender_type: "business" | "client";
  body: string;
  created_at: string | null;
  read_at_business: string | null;
  read_at_client: string | null;
};

function normalizeClientMessage(
  value: Record<string, unknown>,
  clientUserId: string | null
): InitialMessageRecord {
  const senderUserId = value.sender_user_id ? String(value.sender_user_id) : null;
  const isBusinessSender =
    senderUserId !== null && senderUserId !== clientUserId;
  const readAt = value.read_at ? String(value.read_at) : null;

  return {
    id: String(value.id || ""),
    sender_type: isBusinessSender ? "business" : "client",
    body: String(value.body || ""),
    created_at: value.created_at ? String(value.created_at) : null,
    read_at_business: isBusinessSender ? null : readAt,
    read_at_client: isBusinessSender ? readAt : null,
  };
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams?: Promise<MessagesSearchParams>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const businessId = String(params?.businessId || "").trim();
  const conversationId = String(params?.conversationId || "").trim();
  const source = String(params?.source || "").trim();

  if (!businessId && !conversationId) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)] px-4 py-10 text-[var(--text-main)]">
        <div className="mx-auto max-w-3xl rounded-3xl border border-[var(--border-soft)] bg-[var(--panel)] p-8">
          <h1 className="text-2xl font-semibold text-[var(--text-strong)]">
            Messages
          </h1>
          <p className="mt-3 text-sm text-[var(--text-soft)]">
            Choose a published business to start or continue a conversation.
          </p>
          <div className="mt-6">
            <Link
              href="/explore"
              className="inline-flex rounded-xl border border-[var(--border-soft)] px-4 py-2 text-sm text-[var(--text-strong)] transition hover:bg-[var(--panel-strong)]"
            >
              Browse businesses
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const supabaseAdmin = createAdminClient();

  if (conversationId) {
    const access = await getAuthorizedConversationForUser({
      conversationId,
      userId: user?.id || null,
      userEmail: user?.email || null,
    });

    if (!access.conversation || !access.business || !access.role) {
      notFound();
    }

    if (access.role === "business") {
      return (
        <div className="min-h-screen bg-[var(--bg-main)] px-4 py-10 text-[var(--text-main)]">
          <div className="mx-auto max-w-3xl rounded-3xl border border-[var(--border-soft)] bg-[var(--panel)] p-8">
            <h1 className="text-2xl font-semibold text-[var(--text-strong)]">
              You own this business
            </h1>
            <p className="mt-3 text-sm text-[var(--text-soft)]">
              Customer conversations for your business are managed from the
              owner inbox.
            </p>
            <div className="mt-6">
              <Link
                href={`/admin/messages?businessId=${encodeURIComponent(
                  access.business.id
                )}&conversation=${encodeURIComponent(conversationId)}`}
                className="inline-flex rounded-xl border border-[var(--border-soft)] px-4 py-2 text-sm text-[var(--text-strong)] transition hover:bg-[var(--panel-strong)]"
              >
                Open owner inbox
              </Link>
            </div>
          </div>
        </div>
      );
    }

    const messages = await getConversationMessages({
      conversationId,
      businessId: access.conversation.business_id,
    });

    await markConversationReadForClient(conversationId);

    const visibleMessages = Array.isArray(messages)
      ? filterMessagesForRole(
          messages.map((message) =>
            normalizeClientMessage(
              message as unknown as Record<string, unknown>,
              access.conversation!.client_user_id
            )
          ),
          "client"
        )
      : [];

    return (
      <BusinessConversationClient
        conversationId={conversationId}
        businessName={access.business.name || "Business"}
        subject={access.conversation.subject || "Message Business"}
        initialMessages={visibleMessages}
        sourceHref={source || access.conversation.source || "/explore"}
      />
    );
  }

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id, name, owner_id, is_published")
    .eq("id", businessId)
    .maybeSingle();

  if (!business?.id || !business.is_published) {
    notFound();
  }

  if (user?.id && business.owner_id && String(business.owner_id) === user.id) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)] px-4 py-10 text-[var(--text-main)]">
        <div className="mx-auto max-w-3xl rounded-3xl border border-[var(--border-soft)] bg-[var(--panel)] p-8">
          <h1 className="text-2xl font-semibold text-[var(--text-strong)]">
            You own this business
          </h1>
          <p className="mt-3 text-sm text-[var(--text-soft)]">
            Public messaging stays outside admin. Use the owner inbox only when
            you want to manage incoming conversations.
          </p>
          <div className="mt-6">
            <Link
              href="/admin/messages"
              className="inline-flex rounded-xl border border-[var(--border-soft)] px-4 py-2 text-sm text-[var(--text-strong)] transition hover:bg-[var(--panel-strong)]"
            >
              Open owner inbox
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const cookieStore = await cookies();
  const guestToken = cookieStore.get(getGuestConversationCookieName(businessId))?.value;

  if (guestToken) {
    const guestConversation = await getConversationByAccessToken(guestToken);
    if (
      guestConversation.conversation?.id &&
      guestConversation.conversation.business_id === businessId
    ) {
      redirect(`/messages/${encodeURIComponent(guestToken)}`);
    }
  }

  if (user?.id) {
    const metadata = (user.user_metadata || {}) as {
      full_name?: string;
      name?: string;
    };
    const existingConversation = await findConversationForClientBusiness({
      businessId,
      clientUserId: user.id,
      clientEmail: user.email || "",
      clientName: metadata.full_name || metadata.name || user.email || "Client",
      subject: `Message ${business.name || "Business"}`,
      contextType: "general_inquiry",
      contextId: null,
      source: source || "public_business",
    });

    if (existingConversation?.id) {
      const access = await getAuthorizedConversationForUser({
        conversationId: existingConversation.id,
        userId: user.id,
        userEmail: user.email || null,
      });

      if (access.conversation?.id && access.business?.id && access.role === "client") {
        const messages = await getConversationMessages({
          conversationId: existingConversation.id,
          businessId: existingConversation.business_id,
        });

        await markConversationReadForClient(existingConversation.id);

        const visibleMessages = Array.isArray(messages)
          ? filterMessagesForRole(
              messages.map((message) =>
                normalizeClientMessage(
                  message as unknown as Record<string, unknown>,
                  access.conversation!.client_user_id
                )
              ),
              "client"
            )
          : [];

        return (
          <BusinessConversationClient
            conversationId={existingConversation.id}
            businessName={access.business.name || "Business"}
            subject={access.conversation.subject || "Message Business"}
            initialMessages={visibleMessages}
            sourceHref={source || access.conversation.source || "/explore"}
          />
        );
      }
    }
  }

  const metadata = ((user?.user_metadata || {}) as {
    full_name?: string;
    name?: string;
  }) || { };

  return (
    <PublicMessagesClient
      businessId={businessId}
      businessName={business.name || "Business"}
      source={source || null}
      isLoggedIn={Boolean(user)}
      prefillName={metadata.full_name || metadata.name || ""}
      prefillEmail={user?.email || ""}
    />
  );
}
