import { NextResponse } from "next/server";
import { resolveAccessPlanForBusiness } from "@/lib/accessGrants";
import { getBusinessReadinessState } from "@/lib/businessReadiness";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { getFeatureGate } from "@/lib/planEnforcement";
import { createClient } from "@/lib/supabase/server";

type PublishBusinessRow = {
  id: string;
  owner_id: string;
  name: string | null;
  slug: string | null;
  description: string | null;
  business_type: string | null;
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean | null;
  stripe_charges_enabled: boolean | null;
  stripe_payouts_enabled: boolean | null;
  is_published: boolean | null;
  plan?: string | null;
};

const PUBLISH_ROUTE_SELECT = [
  "id",
  "owner_id",
  "name",
  "slug",
  "description",
  "business_type",
  "stripe_account_id",
  "stripe_onboarding_complete",
  "stripe_charges_enabled",
  "stripe_payouts_enabled",
  "is_published",
  "plan",
].join(", ");

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const formData = await req.formData();
    const businessId = String(formData.get("business_id") || "").trim();
    const publishValue = String(formData.get("is_published") || "").trim();
    const isPublished = publishValue === "true";

    if (!businessId) {
      return NextResponse.redirect(
        new URL("/admin/settings?message=missing-business", req.url)
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const activeBusiness = await getActiveBusiness(businessId);

    if (!activeBusiness?.id || activeBusiness.owner_id !== user.id) {
      return NextResponse.redirect(
        new URL("/admin/settings?message=forbidden", req.url)
      );
    }

    const businessesTable = supabase.from("businesses");
    const { data: business, error: businessError } = await businessesTable
      .select(PUBLISH_ROUTE_SELECT)
      .eq("id", activeBusiness.id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (businessError) {
      console.error("[admin/business/publish] ownership lookup failed", {
        userId: user.id,
        businessId,
        message: businessError.message,
        details: businessError.details,
        hint: businessError.hint,
        code: businessError.code,
      });

      return NextResponse.redirect(
        new URL("/admin/settings?message=publish-error", req.url)
      );
    }

    const ownedBusiness = (business || null) as PublishBusinessRow | null;

    if (!ownedBusiness?.id) {
      return NextResponse.redirect(
        new URL("/admin/settings?message=forbidden", req.url)
      );
    }

    const effectivePlan = await resolveAccessPlanForBusiness({
      business: {
        id: ownedBusiness.id,
        owner_id: ownedBusiness.owner_id,
        plan: ownedBusiness.plan,
      },
      userId: user.id,
      email: user.email || null,
    });
    const publishGate = getFeatureGate(
      effectivePlan,
      "publish_business",
      "Publishing is available on Starter Access and above."
    );

    if (isPublished && !publishGate.allowed) {
      return NextResponse.redirect(
        new URL("/admin/settings?message=publish-plan-locked", req.url)
      );
    }

    if (isPublished) {
      const readiness = await getBusinessReadinessState({
        business: ownedBusiness,
        userId: user.id,
      });

      if (!readiness.canPublishLive) {
        const hasLegalBlocker = readiness.blockers.some(
          (blocker) => blocker.kind === "legal"
        );
        return NextResponse.redirect(
          new URL(
            `/admin/settings?message=${hasLegalBlocker ? "legal-incomplete" : "readiness-incomplete"}`,
            req.url
          )
        );
      }
    }

    const { error } = await businessesTable
      .update({ is_published: isPublished })
      .eq("id", ownedBusiness.id)
      .eq("owner_id", user.id);

    if (error) {
      console.error("[admin/business/publish] publish update failed", {
        businessId: ownedBusiness.id,
        ownerId: user.id,
        isPublished,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });

      return NextResponse.redirect(
        new URL("/admin/settings?message=publish-error", req.url)
      );
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[admin/business/publish] updated:", {
        businessId: ownedBusiness.id,
        ownerId: user.id,
        isPublished,
      });
    }

    return NextResponse.redirect(
      new URL(
        `/admin/settings?message=${isPublished ? "published" : "unpublished"}`,
        req.url
      )
    );
  } catch (err) {
    console.error("[admin/business/publish] failed:", err);
    return NextResponse.redirect(
      new URL("/admin/settings?message=publish-error", req.url)
    );
  }
}
