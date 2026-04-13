import { normalizeLanguage, type LanguageCode } from "@/lib/i18n";

export type BusinessPreferences = {
  language: LanguageCode;
  pickup_enabled: boolean;
  delivery_enabled: boolean;
  onsite_enabled: boolean;
  remote_enabled: boolean;
};

export const DEFAULT_BUSINESS_PREFERENCES: BusinessPreferences = {
  language: "en",
  pickup_enabled: true,
  delivery_enabled: true,
  onsite_enabled: true,
  remote_enabled: true,
};

function isMissingPreferenceColumn(error: { code?: string; message?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase();
  return (
    error?.code === "42703" &&
    (message.includes("language") ||
      message.includes("pickup_enabled") ||
      message.includes("delivery_enabled") ||
      message.includes("onsite_enabled") ||
      message.includes("remote_enabled"))
  );
}

export async function loadBusinessPreferences(
  supabase: any,
  businessId: string
): Promise<BusinessPreferences> {
  const { data, error } = await supabase
    .from("businesses")
    .select("language, pickup_enabled, delivery_enabled, onsite_enabled, remote_enabled")
    .eq("id", businessId)
    .maybeSingle();

  if (error) {
    if (isMissingPreferenceColumn(error)) {
      return DEFAULT_BUSINESS_PREFERENCES;
    }
    throw error;
  }

  return {
    language: normalizeLanguage(data?.language),
    pickup_enabled: data?.pickup_enabled !== false,
    delivery_enabled: data?.delivery_enabled !== false,
    onsite_enabled: data?.onsite_enabled !== false,
    remote_enabled: data?.remote_enabled !== false,
  };
}
