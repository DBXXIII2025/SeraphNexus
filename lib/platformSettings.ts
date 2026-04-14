import { createAdminClient } from "@/lib/supabase/server";

export type PlatformSettings = {
  id?: string;
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
  pro_price_active: boolean;
  elite_price_active: boolean;
  pro_stripe_price_id: string | null;
  elite_stripe_price_id: string | null;
  pro_stripe_product_id: string | null;
  elite_stripe_product_id: string | null;
};

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
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
  pro_price_active: true,
  elite_price_active: true,
  pro_stripe_price_id: null,
  elite_stripe_price_id: null,
  pro_stripe_product_id: null,
  elite_stripe_product_id: null,
};

const FEE_MARKER_START = "[seraph_fee_bps:";
const FEE_MARKER_END = "]";

function clampBps(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(10000, Math.max(0, Math.round(parsed)));
}

export function encodePricingNoteWithFeeSettings(
  note: string,
  fees: {
    trial: number;
    pro: number;
    elite: number;
  }
) {
  const cleanNote = String(note || DEFAULT_PLATFORM_SETTINGS.pricing_note)
    .replace(/\s*\[seraph_fee_bps:[^\]]+\]\s*/g, "")
    .trim();
  const marker = `${FEE_MARKER_START}trial=${clampBps(fees.trial, 1000)};pro=${clampBps(
    fees.pro,
    500
  )};elite=${clampBps(fees.elite, 200)}${FEE_MARKER_END}`;
  return `${cleanNote} ${marker}`.trim();
}

function decodeFeeSettingsFromPricingNote(note: unknown) {
  const raw = String(note || "");
  const match = raw.match(/\[seraph_fee_bps:([^\]]+)\]/);
  const values = {
    trial: DEFAULT_PLATFORM_SETTINGS.trial_transaction_fee_bps,
    pro: DEFAULT_PLATFORM_SETTINGS.pro_transaction_fee_bps,
    elite: DEFAULT_PLATFORM_SETTINGS.elite_transaction_fee_bps,
  };

  if (!match) return values;

  for (const part of match[1].split(";")) {
    const [key, value] = part.split("=");
    if (key === "trial") values.trial = clampBps(value, values.trial);
    if (key === "pro") values.pro = clampBps(value, values.pro);
    if (key === "elite") values.elite = clampBps(value, values.elite);
  }

  return values;
}

function publicPricingNote(note: unknown) {
  return String(note || DEFAULT_PLATFORM_SETTINGS.pricing_note)
    .replace(/\s*\[seraph_fee_bps:[^\]]+\]\s*/g, "")
    .trim() || DEFAULT_PLATFORM_SETTINGS.pricing_note;
}

function normalizePlatformSettingsRow(data: Record<string, any>) {
  const fallbackFees = decodeFeeSettingsFromPricingNote(data.pricing_note);
  return {
    id: data.id || undefined,
    platform_name: data.platform_name || DEFAULT_PLATFORM_SETTINGS.platform_name,
    marketing_headline:
      data.marketing_headline || DEFAULT_PLATFORM_SETTINGS.marketing_headline,
    marketing_subheadline:
      data.marketing_subheadline || DEFAULT_PLATFORM_SETTINGS.marketing_subheadline,
    support_email: data.support_email || DEFAULT_PLATFORM_SETTINGS.support_email,
    support_phone: data.support_phone || DEFAULT_PLATFORM_SETTINGS.support_phone,
    pricing_note: publicPricingNote(data.pricing_note),
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
        : fallbackFees.trial,
    pro_transaction_fee_bps:
      typeof data.pro_transaction_fee_bps === "number"
        ? data.pro_transaction_fee_bps
        : fallbackFees.pro,
    elite_transaction_fee_bps:
      typeof data.elite_transaction_fee_bps === "number"
        ? data.elite_transaction_fee_bps
        : fallbackFees.elite,
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
    const { data, error } = await supabase
      .from("platform_settings")
      .select(
        "id, platform_name, marketing_headline, marketing_subheadline, support_email, support_phone, pricing_note, pro_monthly_price_cents, elite_monthly_price_cents, trial_transaction_fee_bps, pro_transaction_fee_bps, elite_transaction_fee_bps, pro_price_active, elite_price_active, pro_stripe_price_id, elite_stripe_price_id, pro_stripe_product_id, elite_stripe_product_id"
      )
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return normalizePlatformSettingsRow(data);
    }

    const { data: legacyData, error: legacyError } = await supabase
      .from("platform_settings")
      .select(
        "id, platform_name, marketing_headline, marketing_subheadline, support_email, support_phone, pricing_note, pro_monthly_price_cents, elite_monthly_price_cents, pro_price_active, elite_price_active, pro_stripe_price_id, elite_stripe_price_id, pro_stripe_product_id, elite_stripe_product_id"
      )
      .limit(1)
      .maybeSingle();

    if (legacyError || !legacyData) {
      return DEFAULT_PLATFORM_SETTINGS;
    }

    return normalizePlatformSettingsRow(legacyData);
  } catch {
    return DEFAULT_PLATFORM_SETTINGS;
  }
}
