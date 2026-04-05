import { NextResponse } from "next/server";
import { resolveAccessPlanForOwner } from "@/lib/accessGrants";
import {
  buildBusinessOnboardingPath,
  createBusinessRecord,
  getBusinessCreationErrorStatus,
  normalizeBusinessCreationInput,
} from "@/lib/businessCreation";
import { getUsageLimitResult } from "@/lib/planEnforcement";
import { getIsPlatformAdminForUserId } from "@/lib/platformAdmin";
import { loadOwnerBusinessCount } from "@/lib/planUsageServer";
import { createAdminClient } from "@/lib/supabase/server";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Server error";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, businessType, baseSlug } = normalizeBusinessCreationInput(
      body || {}
    );

    const supabase = createAdminClient();
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "No auth header" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Invalid user" }, { status: 401 });
    }

    if (await getIsPlatformAdminForUserId(user.id)) {
      return NextResponse.json(
        { error: "Platform-owner account cannot create tenant businesses." },
        { status: 403 }
      );
    }

    const ownerPlan = await resolveAccessPlanForOwner({
      ownerUserId: user.id,
      email: user.email || null,
    });
    const businessCount = await loadOwnerBusinessCount(user.id);
    const businessLimit = getUsageLimitResult({
      plan: ownerPlan,
      limitKey: "max_businesses",
      current: businessCount,
    });

    if (!businessLimit.allowed) {
      return NextResponse.json(
        {
          error:
            businessLimit.message ||
            "Your plan does not allow more businesses.",
        },
        { status: 403 }
      );
    }

    const business = await createBusinessRecord({
      supabase,
      ownerUserId: user.id,
      name,
      businessType,
      baseSlug,
    });

    return NextResponse.json({
      success: true,
      business,
      redirectTo: buildBusinessOnboardingPath(business.id),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: getErrorMessage(err),
      },
      { status: getBusinessCreationErrorStatus(err) }
    );
  }
}
