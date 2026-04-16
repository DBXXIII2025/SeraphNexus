import type { SupabaseClient } from "@supabase/supabase-js";

export type BusinessProfileFields = {
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  social_facebook: string | null;
  social_instagram: string | null;
  social_twitter: string | null;
  hours_json: Record<string, unknown> | null;
  service_area: string | null;
};

export const EMPTY_BUSINESS_PROFILE_FIELDS: BusinessProfileFields = {
  phone: null,
  email: null,
  website: null,
  address: null,
  city: null,
  state: null,
  zip: null,
  country: null,
  social_facebook: null,
  social_instagram: null,
  social_twitter: null,
  hours_json: null,
  service_area: null,
};

export const BUSINESS_PROFILE_FIELD_SELECT = [
  "phone",
  "email",
  "website",
  "address",
  "city",
  "state",
  "zip",
  "country",
  "social_facebook",
  "social_instagram",
  "social_twitter",
  "hours_json",
  "service_area",
].join(", ");

function cleanText(value: unknown) {
  const text = String(value || "").trim();
  return text.length > 0 ? text : null;
}

export function normalizeBusinessProfileFields(
  data: Record<string, unknown> | null | undefined
): BusinessProfileFields {
  return {
    phone: cleanText(data?.phone),
    email: cleanText(data?.email),
    website: cleanText(data?.website),
    address: cleanText(data?.address),
    city: cleanText(data?.city),
    state: cleanText(data?.state),
    zip: cleanText(data?.zip),
    country: cleanText(data?.country),
    social_facebook: cleanText(data?.social_facebook),
    social_instagram: cleanText(data?.social_instagram),
    social_twitter: cleanText(data?.social_twitter),
    hours_json:
      data?.hours_json && typeof data.hours_json === "object"
        ? (data.hours_json as Record<string, unknown>)
        : null,
    service_area: cleanText(data?.service_area),
  };
}

export function formatBusinessAddress(fields: Partial<BusinessProfileFields>) {
  const lineOne = cleanText(fields.address);
  const locality = [fields.city, fields.state, fields.zip].map(cleanText).filter(Boolean).join(", ");
  const country = cleanText(fields.country);
  return [lineOne, locality, country].filter(Boolean).join("\n") || null;
}

export function isMissingBusinessProfileColumns(error: { code?: string | null; message?: string | null } | null) {
  const message = error?.message || "";
  return (
    error?.code === "42703" ||
    message.includes("phone") ||
    message.includes("website") ||
    message.includes("social_") ||
    message.includes("hours_json") ||
    message.includes("service_area")
  );
}

export async function loadBusinessProfileFields(
  supabase: SupabaseClient,
  businessId: string
): Promise<BusinessProfileFields> {
  const { data, error } = await supabase
    .from("businesses")
    .select(BUSINESS_PROFILE_FIELD_SELECT)
    .eq("id", businessId)
    .maybeSingle();

  if (error) {
    if (!isMissingBusinessProfileColumns(error)) {
      console.log("[businessProfileFields] lookup failed", {
        businessId,
        message: error.message,
      });
    }
    return EMPTY_BUSINESS_PROFILE_FIELDS;
  }

  return normalizeBusinessProfileFields((data || {}) as Record<string, unknown>);
}

export function buildBusinessProfileUpdate(input: Record<string, unknown>) {
  return {
    phone: cleanText(input.phone),
    email: cleanText(input.email),
    website: cleanText(input.website),
    address: cleanText(input.address),
    city: cleanText(input.city),
    state: cleanText(input.state),
    zip: cleanText(input.zip),
    country: cleanText(input.country),
    social_facebook: cleanText(input.social_facebook),
    social_instagram: cleanText(input.social_instagram),
    social_twitter: cleanText(input.social_twitter),
    service_area: cleanText(input.service_area),
  };
}
