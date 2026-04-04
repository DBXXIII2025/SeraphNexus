import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getIsPlatformAdminForUserId } from "@/lib/platformAdmin";
import { insertPlatformSupportMessage, PLATFORM_SUPPORT_SOURCE } from "@/lib/platformSupport";

function asString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !(await getIsPlatformAdminForUserId(user.id))) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }

    const formData = await req.formData();
    const conversationId = asString(formData.get("conversation_id"));
    const body = asString(formData.get("body"));

    if (!conversationId || !body) {
      return NextResponse.redirect(new URL("/platform-admin/messages?error=message-required", req.url));
    }

    const supabaseAdmin = createAdminClient();
    const { data: conversation, error } = await supabaseAdmin
      .from("conversations")
      .select("id,business_id,client_user_id,source,context_type")
      .eq("id", conversationId)
      .eq("source", PLATFORM_SUPPORT_SOURCE)
      .eq("context_type", PLATFORM_SUPPORT_SOURCE)
      .maybeSingle();

    if (error || !conversation?.id) {
      return NextResponse.redirect(new URL("/platform-admin/messages?error=thread-not-found", req.url));
    }

    await insertPlatformSupportMessage({
      conversationId: String(conversation.id),
      businessId: String(conversation.business_id),
      senderUserId: user.id,
      recipientUserId:
        typeof conversation.client_user_id === "string"
          ? conversation.client_user_id
          : null,
      body,
    });

    await supabaseAdmin
      .from("conversations")
      .update({
        owner_user_id: user.id,
      })
      .eq("id", conversationId)
      .eq("business_id", conversation.business_id);

    return NextResponse.redirect(
      new URL(
        `/platform-admin/messages?conversation=${encodeURIComponent(conversationId)}&success=sent`,
        req.url
      )
    );
  } catch (error) {
    console.error("[platform-admin/messages/send] failed:", error);
    return NextResponse.redirect(new URL("/platform-admin/messages?error=send-failed", req.url));
  }
}
