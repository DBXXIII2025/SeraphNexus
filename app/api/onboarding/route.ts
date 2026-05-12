import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { resolveAccessPlanForOwner } from "@/lib/accessGrants";
import { getUsageLimitResult } from "@/lib/planEnforcement";
import { getIsPlatformAdminForUserId } from "@/lib/platformAdmin";
import { loadOwnerBusinessCount } from "@/lib/planUsageServer";
import {
  buildBusinessOnboardingPath,
  createBusinessRecord,
  getBusinessCreationErrorStatus,
  normalizeBusinessCreationInput,
} from "@/lib/businessCreation";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown server error";
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const body = await req.json().catch(() => ({}));
    const {
      name,
      businessType,
      baseSlug,
      serviceCategory,
    } = normalizeBusinessCreationInput(body || {});

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const onboardingPlan = ownerPlan === "inactive" ? "starter" : ownerPlan;
    const businessCount = await loadOwnerBusinessCount(user.id);
    const businessLimit = getUsageLimitResult({
      plan: onboardingPlan,
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
      serviceCategory,
    });

    const cookieStore = await cookies();
    cookieStore.set("active_business_id", business.id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return NextResponse.json({
      business,
      redirectTo: buildBusinessOnboardingPath(business.id),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(err) },
      { status: getBusinessCreationErrorStatus(err) }
    );
  }
}
