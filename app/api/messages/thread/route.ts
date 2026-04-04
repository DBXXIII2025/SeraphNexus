import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  filterMessagesForRole,
  getAuthorizedConversationForUser,
  getConversationMessages,
  markConversationReadForBusiness,
  markConversationReadForClient,
  markConversationReadForClientAccessToken,
} from "@/lib/messages";

type NormalizedMessage = {
  id: string;
  sender_type: "business" | "client";
  body: string;
  created_at: string | null;
  read_at_business: string | null;
  read_at_client: string | null;
};

function normalizeThreadMessage(
  value: Record<string, unknown>,
  access: NonNullable<Awaited<ReturnType<typeof getAuthorizedConversationForUser>>["conversation"]>
): NormalizedMessage {
  const senderUserId = value.sender_user_id ? String(value.sender_user_id) : null;
  const isBusinessSender =
    senderUserId !== null && senderUserId === access.owner_user_id;

  return {
    id: String(value.id || ""),
    sender_type: isBusinessSender ? "business" : "client",
    body: String(value.body || ""),
    created_at: value.created_at ? String(value.created_at) : null,
    read_at_business: !isBusinessSender && value.read_at ? String(value.read_at) : null,
    read_at_client: isBusinessSender && value.read_at ? String(value.read_at) : null,
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = String(searchParams.get("conversationId") || "").trim();
    const accessToken = String(
      searchParams.get("guestToken") || searchParams.get("accessToken") || ""
    ).trim();

    if (!conversationId) {
      return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (process.env.NODE_ENV !== "production") {
      console.log("[messages/thread] request", {
        conversationId,
        accessTokenPresent: Boolean(accessToken),
        userId: user?.id || null,
      });
    }

    if (!user && !accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await getAuthorizedConversationForUser({
      conversationId,
      userId: user?.id || null,
      userEmail: user?.email || null,
      accessToken: accessToken || null,
    });

    if (!access.role || !access.conversation || !access.business) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const messages = await getConversationMessages({
      conversationId,
      businessId: access.conversation.business_id,
    });

    if (access.role === "business") {
      await markConversationReadForBusiness(conversationId);
    } else if (accessToken) {
      await markConversationReadForClientAccessToken(accessToken);
    } else {
      await markConversationReadForClient(conversationId);
    }

    const normalizedMessages = Array.isArray(messages)
      ? messages.map((message) =>
          normalizeThreadMessage(
            message as unknown as Record<string, unknown>,
            access.conversation!
          )
        )
      : [];

    const visibleMessages = Array.isArray(normalizedMessages)
      ? filterMessagesForRole(normalizedMessages, access.role)
      : [];

    if (process.env.NODE_ENV !== "production") {
      console.log("[messages/thread] response", {
        conversationId,
        userId: user?.id || null,
        count: visibleMessages.length,
      });
    }

    return NextResponse.json({
      conversation: access.conversation,
      business: access.business,
      role: access.role,
      messages: visibleMessages,
    });
  } catch (err: unknown) {
    console.error("[messages/thread] failed:", err);
    const message =
      err instanceof Error ? err.message : "Failed to load conversation";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
