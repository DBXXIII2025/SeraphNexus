import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { resolveAccessPlanForBusiness } from "@/lib/accessGrants";
import {
  findConversationForClientBusiness,
  getAuthorizedConversationForUser,
  touchConversationAfterMessage,
  upsertConversationForClientBusiness,
} from "@/lib/messages";
import { trackLeadEventServer } from "@/lib/leads.server";
import { canAccessPlanFeature } from "@/lib/planConfig";

type JsonPayload = {
  conversationId?: string;
  businessId?: string;
  body?: string;
  isPrivate?: boolean;
  source?: string;
  senderName?: string;
  senderEmail?: string;
  senderPhone?: string;
  accessToken?: string;
  guestToken?: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_user_id: string | null;
  recipient_user_id: string | null;
  business_id: string;
  body: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by_user_id: string | null;
};

type MessageInsertPayload = {
  conversation_id: string;
  sender_user_id: string | null;
  recipient_user_id: string | null;
  business_id: string;
  body: string;
  is_read: boolean;
  read_at: string | null;
};

const MESSAGE_SELECT =
  "id,conversation_id,sender_user_id,recipient_user_id,business_id,body,is_read,read_at,created_at,is_deleted,deleted_at,deleted_by_user_id";

function isJsonRequest(req: Request) {
  return req.headers.get("content-type")?.includes("application/json") === true;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function redirectError(req: Request, redirectTo: string) {
  return NextResponse.redirect(new URL(redirectTo, req.url));
}

function asMessageRow(value: Record<string, unknown>): MessageRow {
  return {
    id: String(value.id || ""),
    conversation_id: String(value.conversation_id || ""),
    sender_user_id: value.sender_user_id ? String(value.sender_user_id) : null,
    recipient_user_id: value.recipient_user_id
      ? String(value.recipient_user_id)
      : null,
    business_id: String(value.business_id || ""),
    body: String(value.body || ""),
    is_read: value.is_read === true,
    read_at: value.read_at ? String(value.read_at) : null,
    created_at: value.created_at ? String(value.created_at) : null,
    is_deleted: value.is_deleted === true,
    deleted_at: value.deleted_at ? String(value.deleted_at) : null,
    deleted_by_user_id: value.deleted_by_user_id
      ? String(value.deleted_by_user_id)
      : null,
  };
}

async function insertMessage(payload: MessageInsertPayload): Promise<MessageRow> {
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("messages")
    .insert(payload)
    .select(MESSAGE_SELECT)
    .maybeSingle();

  if (error || !data?.id) {
    throw new Error(error?.message || "Failed to save message");
  }

  return asMessageRow(data as Record<string, unknown>);
}

export async function POST(req: Request) {
  const expectsJson = isJsonRequest(req);

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let conversationId = "";
    let businessId = "";
    let body = "";
    let redirectTo = "/";
    let isPrivate = false;
    let source = "public_business";
    let senderName = "";
    let senderEmail = "";
    let senderPhone = "";
    let accessToken = "";

    if (expectsJson) {
      const payload = (await req.json()) as JsonPayload;
      conversationId = String(payload.conversationId || "").trim();
      businessId = String(payload.businessId || "").trim();
      body = String(payload.body || "").trim();
      isPrivate = Boolean(payload.isPrivate);
      source = String(payload.source || "public_business").trim() || "public_business";
      senderName = String(payload.senderName || "").trim();
      senderEmail = String(payload.senderEmail || "").trim().toLowerCase();
      senderPhone = String(payload.senderPhone || "").trim();
      accessToken = String(payload.guestToken || payload.accessToken || "").trim();
    } else {
      const formData = await req.formData();
      conversationId = String(formData.get("conversation_id") || "").trim();
      businessId = String(formData.get("business_id") || "").trim();
      body = String(formData.get("body") || "").trim();
      redirectTo = String(formData.get("redirect_to") || "/").trim() || "/";
      isPrivate = String(formData.get("is_private") || "") === "true";
      source = String(formData.get("source") || "public_business").trim() || "public_business";
      senderName = String(formData.get("sender_name") || "").trim();
      senderEmail = String(formData.get("sender_email") || "").trim().toLowerCase();
      senderPhone = String(formData.get("sender_phone") || "").trim();
      accessToken = String(
        formData.get("guest_token") || formData.get("access_token") || ""
      ).trim();
    }

    if (!body) {
      return expectsJson
        ? jsonError("Message body is required", 400)
        : redirectError(req, redirectTo);
    }

    let access =
      conversationId.length > 0
        ? await getAuthorizedConversationForUser({
            conversationId,
            userId: user?.id || null,
            userEmail: user?.email || null,
            accessToken: accessToken || null,
          })
        : null;

    if ((!access?.conversation || !access.business || !access.role) && businessId) {
      const metadata = ((user?.user_metadata || {}) as {
        full_name?: string;
        name?: string;
      }) || { };

      const resolvedSenderName =
        senderName ||
        metadata.full_name ||
        metadata.name ||
        user?.email ||
        "Guest";
      const resolvedSenderEmail = senderEmail || user?.email || "";

      if (!resolvedSenderEmail) {
        return expectsJson
          ? jsonError("Sender email is required", 400)
          : redirectError(req, redirectTo);
      }

      const existingConversation = await findConversationForClientBusiness({
        businessId,
        clientUserId: user?.id || null,
        clientEmail: resolvedSenderEmail,
        clientName: resolvedSenderName,
        clientPhone: senderPhone || null,
        subject: `Message Business`,
        contextType: "general_inquiry",
        contextId: null,
        source,
      });

      const conversation =
        existingConversation ||
        (await upsertConversationForClientBusiness({
          businessId,
          clientUserId: user?.id || null,
          clientEmail: resolvedSenderEmail,
          clientName: resolvedSenderName,
          clientPhone: senderPhone || null,
          subject: "Message Business",
          contextType: "general_inquiry",
          contextId: null,
          source,
        }));

      access = await getAuthorizedConversationForUser({
        conversationId: conversation.id,
        userId: user?.id || null,
        userEmail: user?.email || null,
        accessToken: conversation.guest_token || conversation.access_token,
      });
      conversationId = conversation.id;
      accessToken = conversation.guest_token || conversation.access_token || accessToken;
    }

    if (!access?.role || !access.conversation || !access.business) {
      return expectsJson
        ? jsonError("Conversation access denied", 403)
        : redirectError(req, redirectTo);
    }

    if (access.role === "business") {
      const supabaseAdmin = createAdminClient();
      const { data: businessPlanRow } = await supabaseAdmin
        .from("businesses")
        .select("id, owner_id, plan")
        .eq("id", access.business.id)
        .maybeSingle();

      if (!businessPlanRow?.id) {
        return expectsJson
          ? jsonError("Conversation access denied", 403)
          : redirectError(req, redirectTo);
      }

      const effectivePlan = await resolveAccessPlanForBusiness({
        business: {
          id: String(businessPlanRow.id),
          owner_id: businessPlanRow.owner_id ? String(businessPlanRow.owner_id) : null,
          plan: businessPlanRow.plan,
        },
        userId: user?.id || null,
        email: user?.email || null,
      });

      if (!canAccessPlanFeature(effectivePlan, "full_messaging")) {
        return expectsJson
          ? jsonError("Customer messaging requires a Pro or Elite plan.", 403)
          : redirectError(req, redirectTo);
      }

      if (isPrivate && !canAccessPlanFeature(effectivePlan, "advanced_messaging")) {
        return expectsJson
          ? jsonError("Private message tools require the Elite plan.", 403)
          : redirectError(req, redirectTo);
      }
    }

    const senderUserId = user?.id || null;
    const recipientUserId =
      access.role === "business"
        ? access.conversation.client_user_id
        : access.conversation.owner_user_id || access.business.owner_id;

    const message = await insertMessage({
      conversation_id: access.conversation.id,
      sender_user_id: senderUserId,
      recipient_user_id: recipientUserId || null,
      business_id: access.conversation.business_id,
      body,
      is_read: false,
      read_at: null,
    });

    await touchConversationAfterMessage({
      conversationId: access.conversation.id,
      senderType: access.role,
      body: message.body,
    });

    try {
      const metadata = ((user?.user_metadata || {}) as {
        full_name?: string;
        name?: string;
      }) || {};

      await trackLeadEventServer({
        businessId: access.conversation.business_id,
        eventType: "message_sent",
        source,
        conversationId: access.conversation.id,
        visitor_name:
          senderName ||
          metadata.full_name ||
          metadata.name ||
          user?.email ||
          null,
        visitor_email: senderEmail || user?.email || null,
        visitor_phone: senderPhone || null,
        metadata: {
          role: access.role,
          hasConversationId: Boolean(conversationId),
        },
      });
    } catch (leadError) {
      console.error("[messages/send] lead tracking failed:", leadError);
    }

    if (expectsJson) {
      return NextResponse.json({
        ok: true,
        message,
        conversationId: access.conversation.id,
        guestToken: access.conversation.guest_token || access.conversation.access_token,
        accessToken: access.conversation.access_token,
        threadPath: access.conversation.guest_token || access.conversation.access_token
          ? `/messages/${encodeURIComponent(
              access.conversation.guest_token || access.conversation.access_token || ""
            )}`
          : `/messages?conversationId=${encodeURIComponent(access.conversation.id)}`,
        businessId: access.conversation.business_id,
        meta: {
          isPrivateIgnored: isPrivate,
        },
      });
    }

    return redirectError(req, redirectTo);
  } catch (err) {
    console.error("[messages/send] failed:", err);
    const message =
      process.env.NODE_ENV !== "production"
        ? (err as Error)?.message || "Failed to send message"
        : "Failed to send message";
    return expectsJson
      ? jsonError(message, 500)
      : redirectError(req, "/");
  }
}
