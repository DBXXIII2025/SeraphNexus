import { NextResponse } from "next/server";
import { getBusinessAnalyticsPerformance } from "@/lib/adminAnalytics";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { canAccessPlanFeature } from "@/lib/planConfig";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    const preset = url.searchParams.get("range");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const supabase = await createClient();
    const business = await getActiveBusiness(businessId);

    if (!business) {
      return NextResponse.json({ error: "No active business." }, { status: 404 });
    }

    if (!canAccessPlanFeature(business.plan, "basic_analytics")) {
      return NextResponse.json(
        { error: "Analytics require a Pro or Elite plan." },
        { status: 403 }
      );
    }

    const analytics = await getBusinessAnalyticsPerformance({
      supabase,
      business,
      preset,
      startDate,
      endDate,
    });

    return NextResponse.json(analytics, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[admin/analytics/performance] failed", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load analytics.",
      },
      { status: 500 }
    );
  }
}
