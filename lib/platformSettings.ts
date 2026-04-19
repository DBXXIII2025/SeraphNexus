import { createAdminClient } from "@/lib/supabase/server";

export type PlatformSettings = {
  id?: string;
  site_name: string;
  logo_url: string | null;
  logo_storage_path: string | null;
  created_at: string | null;
  updated_at: string | null;
  platform_name: string;
  marketing_headline: string;
  marketing_subheadline: string;
  support_email: string;
  support_phone: string;
  pricing_note: string;
  pro_monthly_price_cents: number;
  elite_monthly_price_cents: number;
  trial_transaction_fee_bps: number;
  pro_transaction_fee_bps: number;
  elite_transaction_fee_bps: number;
  pro_plan_name: string;
  pro_plan_subtitle: string;
  pro_plan_features: string[];
  pro_plan_badge: string | null;
  pro_plan_cta: string;
  elite_plan_name: string;
  elite_plan_subtitle: string;
  elite_plan_features: string[];
  elite_plan_badge: string | null;
  elite_plan_cta: string;
  pro_price_active: boolean;
  elite_price_active: boolean;
  pro_stripe_price_id: string | null;
  elite_stripe_price_id: string | null;
  pro_stripe_product_id: string | null;
  elite_stripe_product_id: string | null;
};

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  site_name: "Seraph Nexus",
  logo_url: null,
  logo_storage_path: null,
  created_at: null,
  updated_at: null,
  platform_name: "Seraph Nexus",
  marketing_headline: "Operate bookings, orders, rentals, and client follow-up in one place.",
  marketing_subheadline:
    "Launch-ready business tools with Stripe Connect payouts, admin operations, and polished customer flows.",
  support_email: "support@seraphnexus.com",
  support_phone: "(800) 555-0100",
  pricing_note:
    "Choose the fee tier that matches your growth stage: Free 10%, Pro 5%, Elite 2%.",
  pro_monthly_price_cents: 1900,
  elite_monthly_price_cents: 4900,
  trial_transaction_fee_bps: 1000,
  pro_transaction_fee_bps: 500,
  elite_transaction_fee_bps: 200,
  pro_plan_name: "Pro",
  pro_plan_subtitle:
    "Enable payments, full messaging, basic analytics, and standard owner controls.",
  pro_plan_features: [
    "5% platform fee",
    "Stripe payments, full messaging, and standard customization",
    "Up to 2 businesses with unlimited services and products",
  ],
  pro_plan_badge: null,
  pro_plan_cta: "Choose Pro",
  elite_plan_name: "Elite",
  elite_plan_subtitle:
    "Best economics and the full premium operating stack for scaling businesses.",
  elite_plan_features: [
    "2% platform fee",
    "Automation, advanced analytics, and advanced messaging",
    "Priority explore boost with unlimited businesses",
  ],
  elite_plan_badge: null,
  elite_plan_cta: "Choose Elite",
  pro_price_active: true,
  elite_price_active: true,
  pro_stripe_price_id: null,
  elite_stripe_price_id: null,
  pro_stripe_product_id: null,
  elite_stripe_product_id: null,
};

const PLAN_COPY_NOTE_PREFIX = "__SERAPH_PLAN_COPY_V1__";

type PlanCopyPayload = {
  pricing_note?: string;
  pro?: Partial<
    Pick<
      PlatformSettings,
      "pro_plan_name" | "pro_plan_subtitle" | "pro_plan_features" | "pro_plan_badge" | "pro_plan_cta"
    >
  >;
  elite?: Partial<
    Pick<
      PlatformSettings,
      | "elite_plan_name"
      | "elite_plan_subtitle"
      | "elite_plan_features"
      | "elite_plan_badge"
      | "elite_plan_cta"
    >
  >;
};

function parsePlanCopyPricingNote(value: unknown): PlanCopyPayload {
  const raw = String(value || "").trim();
  if (!raw.startsWith(PLAN_COPY_NOTE_PREFIX)) {
    return { pricing_note: raw };
  }

  try {
    const parsed = JSON.parse(raw.slice(PLAN_COPY_NOTE_PREFIX.length));
    return parsed && typeof parsed === "object" ? parsed : { pricing_note: raw };
  } catch {
    return { pricing_note: raw };
  }
}

export function serializePlanCopyPricingNote(args: {
  pricingNote: string;
  pro: {
    name: string;
    subtitle: string;
    features: string[];
    badge: string | null;
    cta: string;
  };
  elite: {
    name: string;
    subtitle: string;
    features: string[];
    badge: string | null;
    cta: string;
  };
}) {
  return `${PLAN_COPY_NOTE_PREFIX}${JSON.stringify({
    pricing_note: args.pricingNote,
    pro: {
      pro_plan_name: args.pro.name,
      pro_plan_subtitle: args.pro.subtitle,
      pro_plan_features: args.pro.features,
      pro_plan_badge: args.pro.badge,
      pro_plan_cta: args.pro.cta,
    },
    elite: {
      elite_plan_name: args.elite.name,
      elite_plan_subtitle: args.elite.subtitle,
      elite_plan_features: args.elite.features,
      elite_plan_badge: args.elite.badge,
      elite_plan_cta: args.elite.cta,
    },
  })}`;
}

function isMissingPlanCopyColumnError(error: { code?: string | null; message?: string | null } | null) {
  const message = error?.message || "";
  return (
    error?.code === "42703" ||
    message.includes("pro_plan_") ||
    message.includes("elite_plan_")
  );
}

function isMissingBrandingColumnError(error: { code?: string | null; message?: string | null } | null) {
  const message = error?.message || "";
  return (
    error?.code === "42703" ||
    message.includes("site_name") ||
    message.includes("logo_url") ||
    message.includes("logo_storage_path")
  );
}

function normalizePlatformSettingsRow(data: Record<string, any>) {
  const storedPlanCopy = parsePlanCopyPricingNote(data.pricing_note);
  const normalizeFeatures = (value: unknown, fallback: string[]) => {
    if (!Array.isArray(value)) {
      return fallback;
    }
    const features = value
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .slice(0, 10);
    return features.length > 0 ? features : fallback;
  };

  return {
    id: data.id || undefined,
    site_name:
      String(data.site_name || data.platform_name || "").trim() ||
      DEFAULT_PLATFORM_SETTINGS.site_name,
    logo_url:
      typeof data.logo_url === "string" && data.logo_url.trim()
        ? data.logo_url.trim()
        : null,
    logo_storage_path:
      typeof data.logo_storage_path === "string" && data.logo_storage_path.trim()
        ? data.logo_storage_path.trim()
        : null,
    created_at:
      typeof data.created_at === "string" && data.created_at.trim()
        ? data.created_at.trim()
        : null,
    updated_at:
      typeof data.updated_at === "string" && data.updated_at.trim()
        ? data.updated_at.trim()
        : null,
    platform_name: data.platform_name || DEFAULT_PLATFORM_SETTINGS.platform_name,
    marketing_headline:
      data.marketing_headline || DEFAULT_PLATFORM_SETTINGS.marketing_headline,
    marketing_subheadline:
      data.marketing_subheadline || DEFAULT_PLATFORM_SETTINGS.marketing_subheadline,
    support_email: data.support_email || DEFAULT_PLATFORM_SETTINGS.support_email,
    support_phone: data.support_phone || DEFAULT_PLATFORM_SETTINGS.support_phone,
    pricing_note:
      String(storedPlanCopy.pricing_note || "").trim() ||
      DEFAULT_PLATFORM_SETTINGS.pricing_note,
    pro_monthly_price_cents:
      typeof data.pro_monthly_price_cents === "number"
        ? data.pro_monthly_price_cents
        : DEFAULT_PLATFORM_SETTINGS.pro_monthly_price_cents,
    elite_monthly_price_cents:
      typeof data.elite_monthly_price_cents === "number"
        ? data.elite_monthly_price_cents
        : DEFAULT_PLATFORM_SETTINGS.elite_monthly_price_cents,
    trial_transaction_fee_bps:
      typeof data.trial_transaction_fee_bps === "number"
        ? data.trial_transaction_fee_bps
        : DEFAULT_PLATFORM_SETTINGS.trial_transaction_fee_bps,
    pro_transaction_fee_bps:
      typeof data.pro_transaction_fee_bps === "number"
        ? data.pro_transaction_fee_bps
        : DEFAULT_PLATFORM_SETTINGS.pro_transaction_fee_bps,
    elite_transaction_fee_bps:
      typeof data.elite_transaction_fee_bps === "number"
        ? data.elite_transaction_fee_bps
        : DEFAULT_PLATFORM_SETTINGS.elite_transaction_fee_bps,
    pro_plan_name:
      String(data.pro_plan_name || storedPlanCopy.pro?.pro_plan_name || "").trim() ||
      DEFAULT_PLATFORM_SETTINGS.pro_plan_name,
    pro_plan_subtitle:
      String(data.pro_plan_subtitle || storedPlanCopy.pro?.pro_plan_subtitle || "").trim() ||
      DEFAULT_PLATFORM_SETTINGS.pro_plan_subtitle,
    pro_plan_features: normalizeFeatures(
      data.pro_plan_features || storedPlanCopy.pro?.pro_plan_features,
      DEFAULT_PLATFORM_SETTINGS.pro_plan_features
    ),
    pro_plan_badge:
      String(data.pro_plan_badge || storedPlanCopy.pro?.pro_plan_badge || "").trim() || null,
    pro_plan_cta:
      String(data.pro_plan_cta || storedPlanCopy.pro?.pro_plan_cta || "").trim() ||
      DEFAULT_PLATFORM_SETTINGS.pro_plan_cta,
    elite_plan_name:
      String(data.elite_plan_name || storedPlanCopy.elite?.elite_plan_name || "").trim() ||
      DEFAULT_PLATFORM_SETTINGS.elite_plan_name,
    elite_plan_subtitle:
      String(data.elite_plan_subtitle || storedPlanCopy.elite?.elite_plan_subtitle || "").trim() ||
      DEFAULT_PLATFORM_SETTINGS.elite_plan_subtitle,
    elite_plan_features: normalizeFeatures(
      data.elite_plan_features || storedPlanCopy.elite?.elite_plan_features,
      DEFAULT_PLATFORM_SETTINGS.elite_plan_features
    ),
    elite_plan_badge:
      String(data.elite_plan_badge || storedPlanCopy.elite?.elite_plan_badge || "").trim() ||
      null,
    elite_plan_cta:
      String(data.elite_plan_cta || storedPlanCopy.elite?.elite_plan_cta || "").trim() ||
      DEFAULT_PLATFORM_SETTINGS.elite_plan_cta,
    pro_price_active:
      typeof data.pro_price_active === "boolean"
        ? data.pro_price_active
        : DEFAULT_PLATFORM_SETTINGS.pro_price_active,
    elite_price_active:
      typeof data.elite_price_active === "boolean"
        ? data.elite_price_active
        : DEFAULT_PLATFORM_SETTINGS.elite_price_active,
    pro_stripe_price_id:
      typeof data.pro_stripe_price_id === "string" && data.pro_stripe_price_id.trim()
        ? data.pro_stripe_price_id.trim()
        : DEFAULT_PLATFORM_SETTINGS.pro_stripe_price_id,
    elite_stripe_price_id:
      typeof data.elite_stripe_price_id === "string" && data.elite_stripe_price_id.trim()
        ? data.elite_stripe_price_id.trim()
        : DEFAULT_PLATFORM_SETTINGS.elite_stripe_price_id,
    pro_stripe_product_id:
      typeof data.pro_stripe_product_id === "string" && data.pro_stripe_product_id.trim()
        ? data.pro_stripe_product_id.trim()
        : DEFAULT_PLATFORM_SETTINGS.pro_stripe_product_id,
    elite_stripe_product_id:
      typeof data.elite_stripe_product_id === "string" && data.elite_stripe_product_id.trim()
        ? data.elite_stripe_product_id.trim()
        : DEFAULT_PLATFORM_SETTINGS.elite_stripe_product_id,
  };
}

export async function getPlatformSettings() {
  try {
    const supabase = createAdminClient();
    let { data, error } = await supabase
      .from("platform_settings")
      .select(
        "id, site_name, logo_url, logo_storage_path, created_at, updated_at, platform_name, marketing_headline, marketing_subheadline, support_email, support_phone, pricing_note, pro_monthly_price_cents, elite_monthly_price_cents, trial_transaction_fee_bps, pro_transaction_fee_bps, elite_transaction_fee_bps, pro_plan_name, pro_plan_subtitle, pro_plan_features, pro_plan_badge, pro_plan_cta, elite_plan_name, elite_plan_subtitle, elite_plan_features, elite_plan_badge, elite_plan_cta, pro_price_active, elite_price_active, pro_stripe_price_id, elite_stripe_price_id, pro_stripe_product_id, elite_stripe_product_id"
      )
      .limit(1)
      .maybeSingle();

    if (error && (isMissingPlanCopyColumnError(error) || isMissingBrandingColumnError(error))) {
      const fallback = await supabase
        .from("platform_settings")
        .select(
          "id, created_at, updated_at, platform_name, marketing_headline, marketing_subheadline, support_email, support_phone, pricing_note, pro_monthly_price_cents, elite_monthly_price_cents, trial_transaction_fee_bps, pro_transaction_fee_bps, elite_transaction_fee_bps, pro_price_active, elite_price_active, pro_stripe_price_id, elite_stripe_price_id, pro_stripe_product_id, elite_stripe_product_id"
        )
        .limit(1)
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }

    if (!error && data) {
      return normalizePlatformSettingsRow(data);
    }

    return DEFAULT_PLATFORM_SETTINGS;
  } catch {
    return DEFAULT_PLATFORM_SETTINGS;
  }
}
