import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveAccessPlanForBusiness } from "@/lib/accessGrants";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { getAdminConversationSummaries } from "@/lib/messages";
import { canAccessPlanFeature } from "@/lib/planConfig";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const businessId = String(searchParams.get("businessId") || "").trim();
    if (!businessId) {
      return NextResponse.json({ error: "Missing businessId" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await getActiveBusiness(businessId);

    if (!business?.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const effectivePlan = await resolveAccessPlanForBusiness({
      business: {
        id: String(business.id),
        owner_id: business.owner_id ? String(business.owner_id) : null,
        plan: business.plan,
      },
      userId: user.id,
      email: user.email || null,
    });

    if (!canAccessPlanFeature(effectivePlan, "full_messaging")) {
      return NextResponse.json(
        { error: "Customer messaging requires Starter Access or higher." },
        { status: 403 }
      );
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[messages/conversations] request", {
        activeBusinessId: businessId,
        activeBusinessType: business.business_type || null,
        targetBusinessId: businessId,
      });
    }

    const conversations = await getAdminConversationSummaries({
      businessId,
    });

    if (process.env.NODE_ENV !== "production") {
      console.log("[messages/conversations] response", {
        activeBusinessId: businessId,
        count: conversations.length,
      });
    }

    return NextResponse.json({
      conversations,
      targetBusinessId: businessId,
    });
  } catch (err: unknown) {
    console.error("[messages/conversations] failed:", err);
    const message = err instanceof Error ? err.message : "Failed to load inbox";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
