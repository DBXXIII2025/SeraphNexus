import { NextResponse } from "next/server";
import {
  canManageAssistantActions,
  deleteAssistantMemorySummary,
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const body = (await request.json().catch(() => ({}))) as {
    businessId?: unknown;
  };
  const routeParams = await params;
  const memoryId = String(routeParams.id || "").trim();
  const businessId = String(body.businessId || "").trim();

  if (!memoryId) {
    return jsonError("Seravelle memory id is required.", 400);
  }

  const access = await resolveAssistantAccess(businessId || undefined);

  if (!access.userId) {
    return jsonError("You must be signed in to manage Seravelle memory.", 401);
  }

  if (!access.business) {
    return jsonError("No active business is available for this Seravelle memory.", 404);
  }

  if (!access.canUseAssistant) {
    return jsonError("Seravelle requires the Elite plan.", 403);
  }

  if (
    !canManageAssistantActions({
      ownerId: access.business.owner_id,
      userId: access.userId,
      accessRole: access.business.access_role,
      isPlatformAdmin: access.isPlatformAdmin,
    })
  ) {
    return jsonError("You do not have permission to forget Seravelle memories.", 403);
  }

  const deleted = await deleteAssistantMemorySummary({
    id: memoryId,
    businessId: access.business.id,
    userId: access.userId,
  });

  if (!deleted.ok) {
    return jsonError(deleted.error, deleted.error === "Seravelle memory not found." ? 404 : 500);
  }

  return NextResponse.json(
    { ok: true, id: memoryId },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
