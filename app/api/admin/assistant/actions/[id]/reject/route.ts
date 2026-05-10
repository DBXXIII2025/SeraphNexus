import { NextResponse } from "next/server";
import {
  canManageAssistantActions,
  getAssistantActionById,
  resolveAssistantAccess,
  updateAssistantAction,
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const body = (await request.json().catch(() => ({}))) as {
    businessId?: unknown;
  };
  const routeParams = await params;
  const actionId = String(routeParams.id || "").trim();
  const businessId = String(body.businessId || "").trim();

  if (!actionId) {
    return jsonError("Assistant action id is required.", 400);
  }

  const access = await resolveAssistantAccess(businessId || undefined);

  if (!access.userId) {
    return jsonError("You must be signed in to reject assistant actions.", 401);
  }

  if (!access.business) {
    return jsonError("No active business is available for this assistant action.", 404);
  }

  if (!access.canUseAssistant) {
    return jsonError("The AI assistant requires the Elite plan.", 403);
  }

  if (
    !canManageAssistantActions({
      ownerId: access.business.owner_id,
      userId: access.userId,
      accessRole: access.business.access_role,
      isPlatformAdmin: access.isPlatformAdmin,
    })
  ) {
    return jsonError("You do not have permission to reject assistant actions.", 403);
  }

  const actionResult = await getAssistantActionById(actionId);

  if (actionResult.error) {
    return jsonError(actionResult.error, 503);
  }

  const action = actionResult.action;

  if (!action || action.business_id !== access.business.id) {
    return jsonError("Assistant action not found.", 404);
  }

  if (action.status !== "draft") {
    return jsonError("Only draft assistant actions can be rejected.", 409);
  }

  const rejected = await updateAssistantAction({
    id: action.id,
    status: "rejected",
    result: {
      rejected_at: new Date().toISOString(),
      rejected_by: access.userId,
    },
  });

  if (!rejected.ok) {
    return jsonError(rejected.error, 500);
  }

  return NextResponse.json(
    { action: rejected.action },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
