import { NextResponse } from "next/server";
import { getBusinessReadinessState } from "@/lib/businessReadiness";
import { createClient } from "@/lib/supabase/server";

type ToggleBusinessRow = {
  id: string;
  owner_id: string;
  is_published: boolean;
  name: string | null;
  slug: string | null;
  description: string | null;
  email: string | null;
  refund_policy: string | null;
  late_fee_disclosure: string | null;
  business_type: string | null;
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean | null;
  stripe_charges_enabled: boolean | null;
  stripe_payouts_enabled: boolean | null;
};

export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const businessesTable = supabase.from("businesses");
    const { data: businessData } = await businessesTable
      .select(
        "id, owner_id, is_published, name, slug, description, email, refund_policy, late_fee_disclosure, business_type, stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled, stripe_payouts_enabled"
      )
      .eq("owner_id", user.id)
      .single();

    const business = (businessData || null) as ToggleBusinessRow | null;

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const nextPublishedState = !business.is_published;

    if (nextPublishedState) {
      const readiness = await getBusinessReadinessState({
        business,
        userId: user.id,
      });

      if (!readiness.canPublishLive) {
        return NextResponse.json(
          {
            error:
              "Complete the remaining launch-readiness steps before publishing this business.",
          },
          { status: 400 }
        );
      }
    }

    const { data, error } = await businessesTable
      .update({
        is_published: nextPublishedState,
      })
      .eq("id", business.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to update business" },
        { status: 500 }
      );
    }

    return NextResponse.json({ business: data });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update business" },
      { status: 500 }
    );
  }
}
