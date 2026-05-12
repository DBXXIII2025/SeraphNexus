import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { ensureManagedPlanStripePrice } from "@/lib/platformBilling";
import { getIsPlatformAdminForUserId } from "@/lib/platformAdmin";
import { DEFAULT_PLATFORM_SETTINGS } from "@/lib/platformSettings";
import {
  normalizePlatformPlans,
  serializePlatformPlanConfig,
  type PlatformPlanCard,
} from "@/lib/platformPlans";

function normalizeOptionalString(value: FormDataEntryValue | null) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function parseJsonField(value: FormDataEntryValue | null) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isMissingPlanCopyColumnError(error: { code?: string | null; message?: string | null } | null) {
  const message = error?.message || "";
  return (
    error?.code === "42703" ||
    message.includes("pro_plan_") ||
    message.includes("elite_plan_")
  );
}

function isMissingOptionalPlatformColumnError(error: { code?: string | null; message?: string | null } | null) {
  return isMissingPlanCopyColumnError(error);
}

function withoutPlanCopyColumns(payload: Record<string, unknown>, visiblePricingNote: string) {
  const next = { ...payload };
  next.pricing_note = String(payload.pricing_note || visiblePricingNote);

  delete next.pro_plan_name;
  delete next.pro_plan_subtitle;
  delete next.pro_plan_features;
  delete next.pro_plan_badge;
  delete next.pro_plan_cta;
  delete next.elite_plan_name;
  delete next.elite_plan_subtitle;
  delete next.elite_plan_features;
  delete next.elite_plan_badge;
  delete next.elite_plan_cta;

  return next;
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !(await getIsPlatformAdminForUserId(user.id))) {
      return NextResponse.redirect(new URL("/admin/platform", req.url));
    }

    const formData = await req.formData();
    const hasLogoUrlField = formData.has("logo_url");
    const submittedLogoUrl = normalizeOptionalString(formData.get("logo_url"));
    const visiblePricingNote =
      String(formData.get("pricing_note") || "").trim() ||
      DEFAULT_PLATFORM_SETTINGS.pricing_note;
    const payload = {
      platform_name: String(formData.get("platform_name") || "").trim() || "Seraph Nexus",
      marketing_headline:
        String(formData.get("marketing_headline") || "").trim() ||
        "Operate bookings, orders, rentals, and client follow-up in one place.",
      marketing_subheadline:
        String(formData.get("marketing_subheadline") || "").trim() ||
        "Launch-ready business tools with Stripe Connect payouts, admin operations, and polished customer flows.",
      support_email:
        String(formData.get("support_email") || "").trim() || "support@seraphnexus.com",
      support_phone: String(formData.get("support_phone") || "").trim() || "(800) 555-0100",
      pricing_note: visiblePricingNote,
    };

    const supabaseAdmin = createAdminClient();
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("platform_settings")
      .select(
        "id, logo_url, trial_transaction_fee_bps, pro_stripe_price_id, elite_stripe_price_id, pro_stripe_product_id, elite_stripe_product_id"
      )
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error("[admin/platform] settings lookup failed:", existingError);
      return NextResponse.redirect(
        new URL("/admin/platform?error=platform-settings-unavailable", req.url)
      );
    }

    const submittedPlans = normalizePlatformPlans(
      parseJsonField(formData.get("managed_plan_cards_json"))
    );
    const starterPlan = submittedPlans.find((plan) => plan.id === "starter");
    const proPlan = submittedPlans.find((plan) => plan.id === "pro");
    const elitePlan = submittedPlans.find((plan) => plan.id === "elite");

    if (!starterPlan || !proPlan || !elitePlan) {
      return NextResponse.redirect(
        new URL("/admin/platform?error=platform-settings-save-failed", req.url)
      );
    }

    const nextPayload: Record<string, unknown> = {
      ...payload,
      trial_transaction_fee_bps:
        starterPlan.transaction_fee_bps || DEFAULT_PLATFORM_SETTINGS.trial_transaction_fee_bps,
      pro_monthly_price_cents: proPlan.monthly_price_cents,
      elite_monthly_price_cents: elitePlan.monthly_price_cents,
      pro_transaction_fee_bps: proPlan.transaction_fee_bps,
      elite_transaction_fee_bps: elitePlan.transaction_fee_bps,
      pro_plan_name: proPlan.name,
      pro_plan_subtitle: proPlan.subtitle,
      pro_plan_features: proPlan.feature_bullets,
      pro_plan_badge: proPlan.badge_text,
      pro_plan_cta: proPlan.cta_text,
      elite_plan_name: elitePlan.name,
      elite_plan_subtitle: elitePlan.subtitle,
      elite_plan_features: elitePlan.feature_bullets,
      elite_plan_badge: elitePlan.badge_text,
      elite_plan_cta: elitePlan.cta_text,
      pro_price_active: proPlan.is_active,
      elite_price_active: elitePlan.is_active,
      updated_at: new Date().toISOString(),
    };

    if (hasLogoUrlField) {
      nextPayload.logo_url = submittedLogoUrl;
    }

    const syncedPlans = submittedPlans.map((plan) => ({ ...plan }));
    const syncedProPlan = syncedPlans.find((plan) => plan.id === "pro") as PlatformPlanCard;
    const syncedElitePlan = syncedPlans.find((plan) => plan.id === "elite") as PlatformPlanCard;

    if (proPlan.is_active) {
      const proPrice = await ensureManagedPlanStripePrice({
        plan: "pro",
        amountCents: proPlan.monthly_price_cents,
        existingPriceId: existing?.pro_stripe_price_id || null,
        existingProductId: existing?.pro_stripe_product_id || null,
        selectedPriceId: proPlan.stripe_price_id,
        selectedProductId: proPlan.stripe_product_id,
      });
      nextPayload.pro_stripe_price_id = proPrice.stripePriceId;
      nextPayload.pro_stripe_product_id = proPrice.stripeProductId;
      nextPayload.pro_monthly_price_cents = proPrice.amountCents;
      syncedProPlan.stripe_price_id = proPrice.stripePriceId;
      syncedProPlan.stripe_product_id = proPrice.stripeProductId;
      syncedProPlan.monthly_price_cents = proPrice.amountCents;
    }

    if (elitePlan.is_active) {
      const elitePrice = await ensureManagedPlanStripePrice({
        plan: "elite",
        amountCents: elitePlan.monthly_price_cents,
        existingPriceId: existing?.elite_stripe_price_id || null,
        existingProductId: existing?.elite_stripe_product_id || null,
        selectedPriceId: elitePlan.stripe_price_id,
        selectedProductId: elitePlan.stripe_product_id,
      });
      nextPayload.elite_stripe_price_id = elitePrice.stripePriceId;
      nextPayload.elite_stripe_product_id = elitePrice.stripeProductId;
      nextPayload.elite_monthly_price_cents = elitePrice.amountCents;
      syncedElitePlan.stripe_price_id = elitePrice.stripePriceId;
      syncedElitePlan.stripe_product_id = elitePrice.stripeProductId;
      syncedElitePlan.monthly_price_cents = elitePrice.amountCents;
    }

    nextPayload.pricing_note = serializePlatformPlanConfig({
      pricingNote: visiblePricingNote,
      plans: syncedPlans,
    });

    let mutationError = null;

    if (existing?.id) {
      const { error } = await supabaseAdmin
        .from("platform_settings")
        .update(nextPayload)
        .eq("id", existing.id);
      mutationError = error;

      if (isMissingOptionalPlatformColumnError(mutationError)) {
        const { error: fallbackError } = await supabaseAdmin
          .from("platform_settings")
          .update(withoutPlanCopyColumns(nextPayload, visiblePricingNote))
          .eq("id", existing.id);
        mutationError = fallbackError;
      }
    } else {
      const { error } = await supabaseAdmin.from("platform_settings").insert({
        ...nextPayload,
        created_at: new Date().toISOString(),
      });
      mutationError = error;

      if (isMissingOptionalPlatformColumnError(mutationError)) {
        const { error: fallbackError } = await supabaseAdmin.from("platform_settings").insert({
          ...withoutPlanCopyColumns(nextPayload, visiblePricingNote),
          created_at: new Date().toISOString(),
        });
        mutationError = fallbackError;
      }
    }

    if (mutationError) {
      console.error("[admin/platform] settings save failed:", mutationError);
      return NextResponse.redirect(
        new URL("/admin/platform?error=platform-settings-save-failed", req.url)
      );
    }

    revalidatePath("/admin/platform");
    revalidatePath("/pricing");
    revalidatePath("/admin/upgrade");

    return NextResponse.redirect(
      new URL("/admin/platform?success=platform-settings-saved", req.url)
    );
  } catch (err) {
    console.error("[admin/platform] failed:", err);
    return NextResponse.redirect(
      new URL("/admin/platform?error=platform-settings-save-failed", req.url)
    );
  }
}
