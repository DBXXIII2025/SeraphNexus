export const BUSINESS_LOGOS_BUCKET = "business-logos";
export const MAX_BUSINESS_LOGO_BYTES = 2 * 1024 * 1024;

const BUSINESS_LOGO_ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type BusinessLogoState = {
  logoUrl: string | null;
  logoStoragePath: string | null;
  schemaReady: boolean;
  errorMessage: string | null;
};

export function isAllowedBusinessLogoType(contentType: string) {
  return BUSINESS_LOGO_ACCEPTED_TYPES.has(contentType);
}

function sanitizeBusinessLogoFileName(fileName: string) {
  const cleaned = fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned || "logo";
}

export function buildBusinessLogoStoragePath(args: {
  businessId: string;
  fileName: string;
}) {
  const safeName = sanitizeBusinessLogoFileName(args.fileName);
  return `businesses/${args.businessId}/logo/${Date.now()}-${safeName}`;
}

function isMissingLogoColumnError(message: string, code?: string | null) {
  return (
    code === "42703" ||
    message.includes("logo_url") ||
    message.includes("logo_storage_path")
  );
}

export async function loadBusinessLogoById(businessId: string): Promise<BusinessLogoState> {
  const { createAdminClient } = await import("@/lib/supabase/server");

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("businesses")
    .select("logo_url, logo_storage_path")
    .eq("id", businessId)
    .maybeSingle();

  if (error) {
    if (isMissingLogoColumnError(error.message, error.code)) {
      return {
        logoUrl: null,
        logoStoragePath: null,
        schemaReady: false,
        errorMessage:
          "Business logo storage is not configured yet. Apply sql/migrations/20260401_business_logos.sql first.",
      };
    }

    return {
      logoUrl: null,
      logoStoragePath: null,
      schemaReady: false,
      errorMessage: error.message,
    };
  }

  return {
    logoUrl: data?.logo_url ?? null,
    logoStoragePath: data?.logo_storage_path ?? null,
    schemaReady: true,
    errorMessage: null,
  };
}
