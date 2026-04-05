import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveAccessPlanForOwner } from "@/lib/accessGrants";
import { getIsPlatformAdminForUserId } from "@/lib/platformAdmin";
import { getPlanLimit } from "@/lib/planConfig";
import {
  buildBusinessOnboardingPath,
  createBusinessRecord,
  getBusinessCreationErrorStatus,
  normalizeBusinessCreationInput,
} from "@/lib/businessCreation";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Server error";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      businessType,
      baseSlug,
    } = normalizeBusinessCreationInput(body || {});

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
    const maxBusinesses = getPlanLimit(ownerPlan, "max_businesses");

    if (maxBusinesses !== null) {
      const { count, error: countError } = await supabase
        .from("businesses")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id);

      if (countError) {
        return NextResponse.json(
          { error: "Could not validate business limits." },
          { status: 500 }
        );
      }

      if ((count || 0) >= maxBusinesses) {
        return NextResponse.json(
          {
            error:
              maxBusinesses === 1
                ? "Your current plan allows 1 business. Upgrade to Pro for 2 businesses or Elite for unlimited businesses."
                : `Your current plan allows up to ${maxBusinesses} businesses. Upgrade to Elite for unlimited businesses.`,
          },
          { status: 403 }
        );
      }
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
