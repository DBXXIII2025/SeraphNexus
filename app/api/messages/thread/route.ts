import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { resolveAccessPlanForBusiness } from "@/lib/accessGrants";
import {
  filterMessagesForRole,
  getAuthorizedConversationForUser,
  getConversationMessages,
  markConversationReadForBusiness,
  markConversationReadForClient,
  markConversationReadForClientAccessToken,
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
  subject: string | null;
  business_id: string;
  source: string | null;
};

type ThreadBusinessResponse = {
  id: string;
  name: string | null;
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
    subject: access.subject || null,
    business_id: access.business_id,
    source:
      typeof access.source === "string" && access.source.startsWith("/")
        ? access.source
        : null,
  };
}

function normalizeThreadBusiness(
  business: NonNullable<Awaited<ReturnType<typeof getAuthorizedConversationForUser>>["business"]>
): ThreadBusinessResponse {
  return {
    id: business.id,
    name: business.name || null,
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
          { error: "Customer messaging requires a Pro or Elite plan." },
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
