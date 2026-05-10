import { NextResponse } from "next/server";
import {
  canManageAssistantActions,
  executeAssistantAction,
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
    return jsonError("You must be signed in to approve assistant actions.", 401);
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
    return jsonError("You do not have permission to approve assistant actions.", 403);
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
    return jsonError("Only draft assistant actions can be approved.", 409);
  }

  const approvedResult = await updateAssistantAction({
    id: action.id,
    status: "approved",
    result: {
      approved_at: new Date().toISOString(),
      approved_by: access.userId,
    },
  });

  if (!approvedResult.ok) {
    return jsonError(approvedResult.error, 500);
  }

  try {
    const executionResult = await executeAssistantAction({
      action: approvedResult.action,
      business: access.business,
      userId: access.userId,
    });

    const executed = await updateAssistantAction({
      id: action.id,
      status: "executed",
      result: {
        approved_at: new Date().toISOString(),
        approved_by: access.userId,
        execution: executionResult,
      },
    });

    if (!executed.ok) {
      return jsonError(executed.error, 500);
    }

    return NextResponse.json(
      { action: executed.action },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    const failed = await updateAssistantAction({
      id: action.id,
      status: "failed",
      result: {
        approved_at: new Date().toISOString(),
        approved_by: access.userId,
        error: error instanceof Error ? error.message : "Assistant action execution failed.",
      },
    });

    return NextResponse.json(
      {
        error: failed.ok
          ? String(failed.action.result.error || "Assistant action execution failed.")
          : error instanceof Error
            ? error.message
            : "Assistant action execution failed.",
        action: failed.ok ? failed.action : null,
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
