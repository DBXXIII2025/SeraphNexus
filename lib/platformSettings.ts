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
  pro_price_active: true,
  elite_price_active: true,
  pro_stripe_price_id:
    process.env.STRIPE_PRO_PRICE_ID ||
    process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ||
    process.env.STRIPE_GROWTH_PRICE_ID ||
    null,
  elite_stripe_price_id:
    process.env.STRIPE_ELITE_PRICE_ID ||
    process.env.NEXT_PUBLIC_STRIPE_ELITE_PRICE_ID ||
    null,
  pro_stripe_product_id: null,
  elite_stripe_product_id: null,
};

export async function getPlatformSettings() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("platform_settings")
      .select(
        "id, platform_name, marketing_headline, marketing_subheadline, support_email, support_phone, pricing_note, pro_monthly_price_cents, elite_monthly_price_cents, pro_price_active, elite_price_active, pro_stripe_price_id, elite_stripe_price_id, pro_stripe_product_id, elite_stripe_product_id"
      )
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return DEFAULT_PLATFORM_SETTINGS;
    }

    return {
      id: data.id || undefined,
      platform_name: data.platform_name || DEFAULT_PLATFORM_SETTINGS.platform_name,
      marketing_headline:
        data.marketing_headline || DEFAULT_PLATFORM_SETTINGS.marketing_headline,
      marketing_subheadline:
        data.marketing_subheadline ||
        DEFAULT_PLATFORM_SETTINGS.marketing_subheadline,
      support_email: data.support_email || DEFAULT_PLATFORM_SETTINGS.support_email,
      support_phone: data.support_phone || DEFAULT_PLATFORM_SETTINGS.support_phone,
      pricing_note: data.pricing_note || DEFAULT_PLATFORM_SETTINGS.pricing_note,
      pro_monthly_price_cents:
        typeof data.pro_monthly_price_cents === "number"
          ? data.pro_monthly_price_cents
          : DEFAULT_PLATFORM_SETTINGS.pro_monthly_price_cents,
      elite_monthly_price_cents:
        typeof data.elite_monthly_price_cents === "number"
          ? data.elite_monthly_price_cents
          : DEFAULT_PLATFORM_SETTINGS.elite_monthly_price_cents,
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
  } catch {
    return DEFAULT_PLATFORM_SETTINGS;
  }
}
