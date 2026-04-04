import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { syncConversationLastMessageAt } from "@/lib/messages";

type JsonPayload = {
  messageId?: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const payload = (await req.json().catch(() => ({}))) as JsonPayload;
    const messageId = String(payload.messageId || "").trim();

    if (!messageId) {
      return jsonError("Missing messageId", 400);
    }

    const supabaseAdmin = createAdminClient();
    const { data: message, error: messageError } = await supabaseAdmin
      .from("messages")
      .select(
        "id, conversation_id, sender_user_id, business_id, is_deleted, deleted_at, deleted_by_user_id"
      )
      .eq("id", messageId)
      .maybeSingle();

    if (messageError) {
      throw new Error(messageError.message);
    }

    if (!message?.id) {
      return jsonError("Message not found", 404);
    }

    if (message.is_deleted === true) {
      return jsonError("Message already deleted", 409);
    }

    const { data: conversation, error: conversationError } = await supabaseAdmin
      .from("conversations")
      .select("id, business_id, owner_user_id")
      .eq("id", message.conversation_id)
      .maybeSingle();

    if (conversationError) {
      throw new Error(conversationError.message);
    }

    if (!conversation?.id) {
      return jsonError("Conversation not found", 404);
    }

    if (String(conversation.business_id) !== String(message.business_id)) {
      return jsonError("Message not found", 404);
    }

    const { data: business, error: businessError } = await supabaseAdmin
      .from("businesses")
      .select("id, owner_id")
      .eq("id", conversation.business_id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (businessError) {
      throw new Error(businessError.message);
    }

    if (!business?.id) {
      return jsonError("Forbidden", 403);
    }

    const businessSenderId = conversation.owner_user_id
      ? String(conversation.owner_user_id)
      : String(business.owner_id);

    if (!message.sender_user_id || String(message.sender_user_id) !== businessSenderId) {
      return jsonError("Only business-authored messages can be unsent", 403);
    }

    const { error: updateError } = await supabaseAdmin
      .from("messages")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by_user_id: user.id,
      })
      .eq("id", messageId)
      .eq("is_deleted", false);

    if (updateError) {
      throw new Error(updateError.message);
    }

    await syncConversationLastMessageAt({
      conversationId: String(conversation.id),
      businessId: String(conversation.business_id),
    });

    return NextResponse.json({
      ok: true,
      messageId,
      conversationId: String(conversation.id),
    });
  } catch (err: any) {
    console.error("[messages/unsend] failed:", err);
    return jsonError(err?.message || "Failed to unsend message", 500);
  }
}
