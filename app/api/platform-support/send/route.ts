import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { getIsPlatformAdminForUserId } from "@/lib/platformAdmin";
import {
  findOrCreatePlatformSupportConversation,
  insertPlatformSupportMessage,
} from "@/lib/platformSupport";

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

    if (!user) {
      return NextResponse.redirect(new URL("/login?next=%2Fadmin%2Fsupport", req.url));
    }

    if (await getIsPlatformAdminForUserId(user.id)) {
      return NextResponse.redirect(new URL("/admin/messages", req.url));
    }

    const formData = await req.formData();
    const requestedBusinessId = asString(formData.get("business_id"));
    const conversationId = asString(formData.get("conversation_id"));
    const body = asString(formData.get("body"));

    if (!body) {
      return NextResponse.redirect(new URL("/admin/support?error=message-required", req.url));
    }

    const business = await getActiveBusiness(requestedBusinessId || undefined);

    if (!business?.id || String(business.owner_id || "") !== user.id) {
      return NextResponse.redirect(new URL("/admin/support?error=active-business-required", req.url));
    }

    const supportConversationId =
      conversationId ||
      (await findOrCreatePlatformSupportConversation({
        businessId: String(business.id),
        businessName: business.name || null,
        businessType: business.business_type || null,
        ownerUserId: user.id,
        ownerName:
          typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : typeof user.user_metadata?.name === "string"
              ? user.user_metadata.name
              : user.email || null,
        ownerEmail: user.email || null,
        ownerPhone: null,
      }));

    await insertPlatformSupportMessage({
      conversationId: supportConversationId,
      businessId: String(business.id),
      senderUserId: user.id,
      recipientUserId: null,
      body,
    });

    return NextResponse.redirect(
      new URL(
        `/admin/support?conversation=${encodeURIComponent(supportConversationId)}&success=sent`,
        req.url
      )
    );
  } catch (error) {
    console.error("[platform-support/send] failed:", error);
    return NextResponse.redirect(new URL("/admin/support?error=send-failed", req.url));
  }
}
