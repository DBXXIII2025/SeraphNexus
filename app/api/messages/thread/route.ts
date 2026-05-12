import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { resolveAccessPlanForBusiness } from "@/lib/accessGrants";
import {
  formatConversationTag,
  filterMessagesForRole,
  getAuthorizedConversationForUser,
  getConversationMessages,
  markConversationReadForBusiness,
  markConversationReadForClient,
  markConversationReadForClientAccessToken,
  normalizeConversationStatus,
} from "@/lib/messages";
import { canAccessPlanFeature } from "@/lib/planConfig";

type NormalizedMessage = {
  id: string;
  sender_type: "business" | "client";
  body: string;
  created_at: string | null;
  read_at_business: string | null;
  read_at_client: string | null;
};

type ThreadConversationResponse = {
  id: string;
  tag: string;
  subject: string | null;
  business_id: string;
  source: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  context_type: string | null;
  context_id: string | null;
  booking_id: string | null;
  last_message_at: string | null;
  status: "open" | "resolved" | "archived";
};

type ThreadBusinessResponse = {
  id: string;
  name: string | null;
  business_type: string | null;
};

function normalizeThreadMessage(
  value: Record<string, unknown>,
  access: NonNullable<Awaited<ReturnType<typeof getAuthorizedConversationForUser>>["conversation"]>
): NormalizedMessage {
  const senderUserId = value.sender_user_id ? String(value.sender_user_id) : null;
  const isBusinessSender =
    senderUserId !== null &&
    senderUserId !== access.client_user_id;

  return {
    id: String(value.id || ""),
    sender_type: isBusinessSender ? "business" : "client",
    body: String(value.body || ""),
    created_at: value.created_at ? String(value.created_at) : null,
    read_at_business: !isBusinessSender && value.read_at ? String(value.read_at) : null,
    read_at_client: isBusinessSender && value.read_at ? String(value.read_at) : null,
  };
}

function normalizeThreadConversation(
  access: NonNullable<Awaited<ReturnType<typeof getAuthorizedConversationForUser>>["conversation"]>
): ThreadConversationResponse {
  return {
    id: access.id,
    tag: formatConversationTag(access.id),
    subject: access.subject || null,
    business_id: access.business_id,
    source: access.source || null,
    client_name: access.client_name || null,
    client_email: access.client_email || null,
    client_phone: access.client_phone || null,
    context_type: access.context_type || null,
    context_id: access.context_id || null,
    booking_id: access.booking_id || null,
    last_message_at: access.last_message_at || null,
    status: normalizeConversationStatus((access as { status?: unknown }).status),
  };
}

function normalizeThreadBusiness(
  business: NonNullable<Awaited<ReturnType<typeof getAuthorizedConversationForUser>>["business"]>
): ThreadBusinessResponse {
  return {
    id: business.id,
    name: business.name || null,
    business_type: business.business_type || null,
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

    if (access.role === "business") {
      const supabaseAdmin = createAdminClient();
      const { data: business } = await supabaseAdmin
        .from("businesses")
        .select("id, owner_id, plan")
        .eq("id", access.business.id)
        .maybeSingle();

      if (!business?.id) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }

      const effectivePlan = await resolveAccessPlanForBusiness({
        business: {
          id: String(business.id),
          owner_id: business.owner_id ? String(business.owner_id) : null,
          plan: business.plan,
        },
        userId: user?.id || null,
        email: user?.email || null,
      });

      if (!canAccessPlanFeature(effectivePlan, "full_messaging")) {
        return NextResponse.json(
          { error: "Customer messaging requires Starter Access or higher." },
          { status: 403 }
        );
      }
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
      conversation: normalizeThreadConversation(access.conversation),
      business: normalizeThreadBusiness(access.business),
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
