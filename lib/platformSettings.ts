import { createAdminClient } from "@/lib/supabase/server";

export type PlatformSettings = {
  platform_name: string;
  marketing_headline: string;
  marketing_subheadline: string;
  support_email: string;
  support_phone: string;
  pricing_note: string;
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
};

export async function getPlatformSettings() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("platform_settings")
      .select(
        "platform_name, marketing_headline, marketing_subheadline, support_email, support_phone, pricing_note"
      )
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return DEFAULT_PLATFORM_SETTINGS;
    }

    return {
      platform_name: data.platform_name || DEFAULT_PLATFORM_SETTINGS.platform_name,
      marketing_headline:
        data.marketing_headline || DEFAULT_PLATFORM_SETTINGS.marketing_headline,
      marketing_subheadline:
        data.marketing_subheadline ||
        DEFAULT_PLATFORM_SETTINGS.marketing_subheadline,
      support_email: data.support_email || DEFAULT_PLATFORM_SETTINGS.support_email,
      support_phone: data.support_phone || DEFAULT_PLATFORM_SETTINGS.support_phone,
      pricing_note: data.pricing_note || DEFAULT_PLATFORM_SETTINGS.pricing_note,
    };
  } catch {
    return DEFAULT_PLATFORM_SETTINGS;
  }
}
