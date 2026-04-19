import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { ensureManagedPlanStripePrice } from "@/lib/platformBilling";
import { getIsPlatformAdminForUserId } from "@/lib/platformAdmin";
import { serializePlanCopyPricingNote } from "@/lib/platformSettings";

function parsePriceCents(value: FormDataEntryValue | null, fallback: number) {
  const raw = String(value || "").trim();
  const amount = Number(raw);

  if (!Number.isFinite(amount) || amount < 0) {
    return fallback;
  }

  return Math.round(amount * 100);
}

function normalizeOptionalString(value: FormDataEntryValue | null) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function normalizeRequiredString(value: FormDataEntryValue | null, fallback: string) {
  return String(value || "").trim() || fallback;
}

function normalizeFeatureList(value: FormDataEntryValue | null, fallback: string[]) {
  const features = String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 10);

  return features.length > 0 ? features : fallback;
}

function parseFeeBasisPoints(value: FormDataEntryValue | null, fallback: number) {
  const raw = String(value || "").trim();
  const percent = Number(raw);

  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    return fallback;
  }

  return Math.round(percent * 100);
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
  const message = error?.message || "";
  return isMissingPlanCopyColumnError(error) || error?.code === "42703" || message.includes("site_name");
}

function withoutPlanCopyColumns(payload: Record<string, unknown>, visiblePricingNote: string) {
  const next = { ...payload };
  next.pricing_note = serializePlanCopyPricingNote({
    pricingNote: visiblePricingNote,
    pro: {
      name: String(payload.pro_plan_name || "Pro"),
      subtitle: String(
        payload.pro_plan_subtitle ||
          "Enable payments, full messaging, basic analytics, and standard owner controls."
      ),
      features: Array.isArray(payload.pro_plan_features)
        ? payload.pro_plan_features.map((item) => String(item))
        : [],
      badge: typeof payload.pro_plan_badge === "string" ? payload.pro_plan_badge : null,
      cta: String(payload.pro_plan_cta || "Choose Pro"),
    },
    elite: {
      name: String(payload.elite_plan_name || "Elite"),
      subtitle: String(
        payload.elite_plan_subtitle ||
          "Best economics and the full premium operating stack for scaling businesses."
      ),
      features: Array.isArray(payload.elite_plan_features)
        ? payload.elite_plan_features.map((item) => String(item))
        : [],
      badge: typeof payload.elite_plan_badge === "string" ? payload.elite_plan_badge : null,
      cta: String(payload.elite_plan_cta || "Choose Elite"),
    },
  });

  delete next.pro_plan_name;
  delete next.site_name;
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
    const selectedProPriceId = normalizeOptionalString(formData.get("pro_stripe_price_id_override"));
    const selectedElitePriceId = normalizeOptionalString(
      formData.get("elite_stripe_price_id_override")
    );
    const trialFeeBps = parseFeeBasisPoints(formData.get("trial_transaction_fee_percent"), 1000);
    const proFeeBps = parseFeeBasisPoints(formData.get("pro_transaction_fee_percent"), 500);
    const eliteFeeBps = parseFeeBasisPoints(formData.get("elite_transaction_fee_percent"), 200);
    const visiblePricingNote =
      String(formData.get("pricing_note") || "").trim() ||
      "Choose the fee tier that matches your growth stage: Free 10%, Pro 5%, Elite 2%.";
    const payload = {
      platform_name: String(formData.get("platform_name") || "").trim() || "Seraph Nexus",
      site_name: String(formData.get("platform_name") || "").trim() || "Seraph Nexus",
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
      pro_monthly_price_cents: parsePriceCents(formData.get("pro_monthly_price"), 1900),
      elite_monthly_price_cents: parsePriceCents(formData.get("elite_monthly_price"), 4900),
      trial_transaction_fee_bps: trialFeeBps,
      pro_transaction_fee_bps: proFeeBps,
      elite_transaction_fee_bps: eliteFeeBps,
      pro_plan_name: normalizeRequiredString(formData.get("pro_plan_name"), "Pro"),
      pro_plan_subtitle: normalizeRequiredString(
        formData.get("pro_plan_subtitle"),
        "Enable payments, full messaging, basic analytics, and standard owner controls."
      ),
      pro_plan_features: normalizeFeatureList(formData.get("pro_plan_features"), [
        "5% platform fee",
        "Stripe payments, full messaging, and standard customization",
        "Up to 2 businesses with unlimited services and products",
      ]),
      pro_plan_badge: normalizeOptionalString(formData.get("pro_plan_badge")),
      pro_plan_cta: normalizeRequiredString(formData.get("pro_plan_cta"), "Choose Pro"),
      elite_plan_name: normalizeRequiredString(formData.get("elite_plan_name"), "Elite"),
      elite_plan_subtitle: normalizeRequiredString(
        formData.get("elite_plan_subtitle"),
        "Best economics and the full premium operating stack for scaling businesses."
      ),
      elite_plan_features: normalizeFeatureList(formData.get("elite_plan_features"), [
        "2% platform fee",
        "Automation, advanced analytics, and advanced messaging",
        "Priority explore boost with unlimited businesses",
      ]),
      elite_plan_badge: normalizeOptionalString(formData.get("elite_plan_badge")),
      elite_plan_cta: normalizeRequiredString(formData.get("elite_plan_cta"), "Choose Elite"),
      pro_price_active: formData.get("pro_price_active") === "on",
      elite_price_active: formData.get("elite_price_active") === "on",
    };

    const supabaseAdmin = createAdminClient();
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("platform_settings")
      .select(
        "id, pro_stripe_price_id, elite_stripe_price_id, pro_stripe_product_id, elite_stripe_product_id"
      )
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error("[admin/platform] settings lookup failed:", existingError);
      return NextResponse.redirect(
        new URL("/admin/platform?error=platform-settings-unavailable", req.url)
      );
    }

    const nextPayload: Record<string, unknown> = {
      ...payload,
      updated_at: new Date().toISOString(),
    };

    if (payload.pro_price_active) {
      const proPrice = await ensureManagedPlanStripePrice({
        plan: "pro",
        amountCents: payload.pro_monthly_price_cents,
        existingPriceId: existing?.pro_stripe_price_id || null,
        existingProductId: existing?.pro_stripe_product_id || null,
        selectedPriceId: selectedProPriceId,
      });
      nextPayload.pro_stripe_price_id = proPrice.stripePriceId;
      nextPayload.pro_stripe_product_id = proPrice.stripeProductId;
      nextPayload.pro_monthly_price_cents = proPrice.amountCents;
    }

    if (payload.elite_price_active) {
      const elitePrice = await ensureManagedPlanStripePrice({
        plan: "elite",
        amountCents: payload.elite_monthly_price_cents,
        existingPriceId: existing?.elite_stripe_price_id || null,
        existingProductId: existing?.elite_stripe_product_id || null,
        selectedPriceId: selectedElitePriceId,
      });
      nextPayload.elite_stripe_price_id = elitePrice.stripePriceId;
      nextPayload.elite_stripe_product_id = elitePrice.stripeProductId;
      nextPayload.elite_monthly_price_cents = elitePrice.amountCents;
    }

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
