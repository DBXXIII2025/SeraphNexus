import { notFound } from "next/navigation";
import BusinessConversationClient from "../business/[conversationId]/BusinessConversationClient";
import {
  filterMessagesForRole,
  getConversationByAccessToken,
  getConversationMessages,
  markConversationReadForClientAccessToken,
} from "@/lib/messages";

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
  ownerUserId: string | null
): InitialMessageRecord {
  const senderUserId = value.sender_user_id ? String(value.sender_user_id) : null;
  const isBusinessSender =
    senderUserId !== null && ownerUserId !== null && senderUserId === ownerUserId;
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

export default async function ClientMessagesPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const access = await getConversationByAccessToken(token);

  if (!access.conversation || !access.business) {
    notFound();
  }

  const messages = await getConversationMessages({
    conversationId: access.conversation.id,
    businessId: access.conversation.business_id,
  });

  await markConversationReadForClientAccessToken(token);

  const visibleMessages = Array.isArray(messages)
    ? filterMessagesForRole(
        messages.map((message) =>
          normalizeClientMessage(
            message as unknown as Record<string, unknown>,
            access.conversation.owner_user_id || access.business.owner_id
          )
        ),
        "client"
      )
    : [];

  return (
    <BusinessConversationClient
      conversationId={access.conversation.id}
      businessName={access.business.name || "Business"}
      subject={access.conversation.subject || "Message Business"}
      initialMessages={visibleMessages}
      accessToken={token}
      sourceHref={access.conversation.source || "/explore"}
    />
  );
}
