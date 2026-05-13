import { NextResponse } from "next/server";
import {
  archiveAssistantConversationAndStartFresh,
  createFreshAssistantConversation,
  resolveAssistantAccess,
} from "@/lib/assistant";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    businessId?: unknown;
    currentConversationId?: unknown;
    action?: unknown;
  };

  const businessId = String(body.businessId || "").trim();
  const currentConversationId = String(body.currentConversationId || "").trim();
  const action = String(body.action || "").trim().toLowerCase();

  if (action !== "new" && action !== "clear") {
    return jsonError("Unsupported Seravelle conversation action.", 400);
  }

  const access = await resolveAssistantAccess(businessId || undefined);

  if (!access.userId) {
    return jsonError("You must be signed in to manage Seravelle conversations.", 401);
  }

  if (!access.business) {
    return jsonError("No active business is available for this Seravelle request.", 404);
  }

  if (!access.canUseAssistant) {
    return jsonError("Seravelle requires the Elite plan.", 403);
  }

  if (!currentConversationId) {
    const created = await createFreshAssistantConversation({
      businessId: access.business.id,
      userId: access.userId,
      status: "active",
    });

    if (!created.ok) {
      return jsonError(created.error, 503);
    }

    return NextResponse.json(
      {
        conversation: created.conversation,
        notice: null,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const archiveResult = await archiveAssistantConversationAndStartFresh({
    businessId: access.business.id,
    userId: access.userId,
    currentConversationId,
    archiveStatus: action === "clear" ? "cleared" : "archived",
  });

  if (!archiveResult.ok) {
    return jsonError(archiveResult.error, 503);
  }

  return NextResponse.json(
    {
      conversation: archiveResult.conversation,
      notice:
        action === "clear"
          ? "This conversation has been archived. Seravelle can still recall relevant information from it when needed."
          : "A fresh Seravelle conversation is ready.",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
