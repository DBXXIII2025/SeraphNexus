import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveAccessPlanForBusiness } from "@/lib/accessGrants";
import { errorResponse, getErrorMessage, logRouteError } from "@/lib/apiErrors";

type BusinessesTable = {
  select: (query: string) => {
    eq: (column: string, value: string) => {
      single: () => Promise<{
        data: { id?: string | null; owner_id?: string | null; plan?: string | null } | null;
        error: { message: string } | null;
      }>;
    };
  };
};

export async function POST(req: Request) {
  let step = "request.parse";

  try {
    const supabase = await createClient();

    const body = await req.json();
    const { slug } = body;

    if (!slug) {
      return errorResponse({
        status: 400,
        error: "Business slug is required to prepare checkout.",
        code: "PUBLIC_CHECKOUT_SLUG_REQUIRED",
        step: "request.validate",
      });
    }

    const businessesTable = supabase.from("businesses") as unknown as BusinessesTable;
    step = "business.read";

    const { data: business, error } = await businessesTable
      .select("*")
      .eq("slug", slug)
      .single();

    if (error || !business) {
      if (error) {
        logRouteError("public/checkout", {
          step,
          code: "PUBLIC_CHECKOUT_BUSINESS_READ_FAILED",
          message: error.message,
          status: 500,
          error,
          extra: { slug },
        });

        return errorResponse({
          status: 500,
          error: "We couldn't prepare checkout right now.",
          code: "PUBLIC_CHECKOUT_BUSINESS_READ_FAILED",
          step,
        });
      }

      return errorResponse({
        status: 404,
        error: "This business is unavailable.",
        code: "PUBLIC_CHECKOUT_BUSINESS_NOT_FOUND",
        step,
      });
    }

    const normalizedPlan = await resolveAccessPlanForBusiness({
      business: {
        id: String(business.id || ""),
        owner_id: business.owner_id || null,
        plan: business.plan,
      },
    });

    if (normalizedPlan === "inactive") {
      return errorResponse({
        status: 403,
        error: "This business is not enabled for checkout yet.",
        code: "PUBLIC_CHECKOUT_PLAN_RESTRICTED",
        step: "business.plan.validate",
      });
    }

    return NextResponse.json({
      success: true,
      message: "Checkout ready",
    });
  } catch (err: unknown) {
    logRouteError("public/checkout", {
      step,
      code: "PUBLIC_CHECKOUT_FAILED",
      message: getErrorMessage(err, "Public checkout failed"),
      status: 500,
      error: err,
    });

    return errorResponse({
      status: 500,
      error: "We couldn't prepare checkout right now.",
      code: "PUBLIC_CHECKOUT_FAILED",
      step,
    });
  }
}
