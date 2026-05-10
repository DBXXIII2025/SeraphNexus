import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  formatConversationTag,
  getAuthorizedConversationForUser,
  normalizeConversationStatus,
  type ConversationStatus,
} from "@/lib/messages";

const ALLOWED_STATUSES = new Set<ConversationStatus>(["open", "resolved", "archived"]);

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

    const body = (await req.json().catch(() => ({}))) as {
      conversationId?: unknown;
      status?: unknown;
    };

    const conversationId = String(body.conversationId || "").trim();
    const status = String(body.status || "").trim() as ConversationStatus;

    if (!conversationId || !ALLOWED_STATUSES.has(status)) {
      return jsonError("Conversation id and a valid status are required.", 400);
    }

    const access = await getAuthorizedConversationForUser({
      conversationId,
      userId: user.id,
      userEmail: user.email || null,
    });

    if (!access.conversation?.id || !access.business?.id || access.role !== "business") {
      return jsonError("Conversation not found.", 404);
    }

    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin
      .from("conversations")
      .update({ status })
      .eq("id", conversationId)
      .eq("business_id", access.business.id)
      .select("*")
      .maybeSingle();

    if (error) {
      if (error.code === "42703") {
        return jsonError(
          "Conversation status is not installed yet. Apply the conversation status migration first.",
          503
        );
      }
      throw new Error(error.message);
    }

    if (!data?.id) {
      return jsonError("Conversation not found.", 404);
    }

    return NextResponse.json({
      conversation: {
        id: String(data.id),
        tag: formatConversationTag(String(data.id)),
        status: normalizeConversationStatus((data as { status?: unknown }).status),
      },
    });
  } catch (error) {
    console.error("[messages/conversation-status] failed:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to update conversation status.",
      500
    );
  }
}
