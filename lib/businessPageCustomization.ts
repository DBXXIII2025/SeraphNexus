import type { SupabaseClient } from "@supabase/supabase-js";

export const BUSINESS_PAGE_IMAGES_BUCKET = "business-assets";
export const MAX_BUSINESS_PAGE_IMAGE_BYTES = 8 * 1024 * 1024;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DEFAULT_THEME = {
  accentColor: "#2563eb",
  textColor: "#111827",
  backgroundColor: "#f4f6f8",
  headingFontSize: 36,
  bodyFontSize: 16,
};

export type BusinessPageImage = {
  id: string;
  image_url: string;
  storage_path: string | null;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
};

export type BusinessPageTheme = typeof DEFAULT_THEME & {
  accentTextColor: string;
};

export type BusinessPageCustomization = {
  theme: BusinessPageTheme;
  images: BusinessPageImage[];
  logoUrl: string | null;
  schemaReady: boolean;
  errorMessage: string | null;
};

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function normalizeHexColor(value: unknown, fallback: string) {
  const raw = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(raw)) {
    return raw.toLowerCase();
  }
  return fallback;
}

function hexToRgb(hex: string) {
  return {
    r: parseInt(hex.slice(1, 3), 16) / 255,
    g: parseInt(hex.slice(3, 5), 16) / 255,
    b: parseInt(hex.slice(5, 7), 16) / 255,
  };
}

function linearize(channel: number) {
  return channel <= 0.03928
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
}

function luminance(hex: string) {
  const rgb = hexToRgb(hex);
  return 0.2126 * linearize(rgb.r) + 0.7152 * linearize(rgb.g) + 0.0722 * linearize(rgb.b);
}

function contrastRatio(a: string, b: string) {
  const high = Math.max(luminance(a), luminance(b));
  const low = Math.min(luminance(a), luminance(b));
  return (high + 0.05) / (low + 0.05);
}

function channelToHex(value: number) {
  return Math.round(value).toString(16).padStart(2, "0");
}

function mixWithWhite(hex: string, whiteRatio: number) {
  const rgb = hexToRgb(hex);
  const ratio = Math.min(1, Math.max(0, whiteRatio));
  const r = rgb.r * 255 * (1 - ratio) + 255 * ratio;
  const g = rgb.g * 255 * (1 - ratio) + 255 * ratio;
  const b = rgb.b * 255 * (1 - ratio) + 255 * ratio;
  return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`;
}

export function normalizeBusinessPageTheme(data: Record<string, unknown> = {}): BusinessPageTheme {
  const accentColor = normalizeHexColor(data.page_accent_color, DEFAULT_THEME.accentColor);
  const backgroundColor = normalizeHexColor(
    data.page_background_color,
    mixWithWhite(accentColor, 0.92)
  );
  const textColor = normalizeHexColor(data.page_text_color, DEFAULT_THEME.textColor);
  const safeTextColor =
    contrastRatio(textColor, "#ffffff") >= 4.5 ? textColor : DEFAULT_THEME.textColor;

  return {
    accentColor,
    textColor: safeTextColor,
    backgroundColor,
    headingFontSize: clampNumber(
      data.heading_font_size ?? data.page_heading_font_size,
      24,
      56,
      DEFAULT_THEME.headingFontSize
    ),
    bodyFontSize: clampNumber(
      data.body_font_size ?? data.page_body_font_size,
      14,
      20,
      DEFAULT_THEME.bodyFontSize
    ),
    accentTextColor: contrastRatio(accentColor, "#ffffff") >= 4.5 ? "#ffffff" : "#111827",
  };
}

export function isAllowedBusinessPageImageType(contentType: string) {
  return IMAGE_TYPES.has(contentType);
}

function sanitizeFileName(fileName: string) {
  return (
    fileName
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "business-photo"
  );
}

export function buildBusinessPageImagePath(args: { businessId: string; fileName: string }) {
  return `businesses/${args.businessId}/gallery/${Date.now()}-${sanitizeFileName(args.fileName)}`;
}

function isMissingCustomizationSchemaError(error: { code?: string | null; message?: string | null } | null) {
  const message = error?.message || "";
  return (
    error?.code === "42703" ||
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    message.includes("business_page_images") ||
    message.includes("heading_font_size") ||
    message.includes("body_font_size") ||
    message.includes("page_accent_color") ||
    message.includes("page_text_color")
  );
}

function normalizeGalleryRows(rows: Array<Record<string, unknown>> = []) {
  return rows
    .filter((image) => typeof image.image_url === "string" && image.image_url.trim())
    .map((image, index) => ({
      id: String(image.id || ""),
      image_url: String(image.image_url || ""),
      storage_path:
        typeof image.storage_path === "string" && image.storage_path.trim()
          ? image.storage_path.trim()
          : null,
      alt_text:
        typeof image.alt_text === "string" && image.alt_text.trim()
          ? image.alt_text.trim()
          : null,
      sort_order: Number.isFinite(Number(image.sort_order))
        ? Number(image.sort_order)
        : index + 1,
      is_primary: image.is_primary === true,
    }));
}

export async function loadBusinessPageCustomization(
  supabase: SupabaseClient,
  businessId: string
): Promise<BusinessPageCustomization> {
  try {
    console.log("[businessPageCustomization] gallery query business_id", {
      businessId,
    });

    let businessQuery = await supabase
      .from("businesses")
      .select("logo_url, page_accent_color, page_text_color, heading_font_size, body_font_size")
      .eq("id", businessId)
      .maybeSingle();

    if (businessQuery.error && isMissingCustomizationSchemaError(businessQuery.error)) {
      businessQuery = await supabase
        .from("businesses")
        .select("logo_url")
        .eq("id", businessId)
        .maybeSingle();
    }

    const { data: business, error: businessError } = businessQuery;

    if (businessError) {
      return {
        theme: normalizeBusinessPageTheme(),
        images: [],
        logoUrl: null,
        schemaReady: false,
        errorMessage: businessError.message || "Business page customization is unavailable.",
      };
    }

    const { data: images, error: imagesError } = await supabase
      .from("business_page_images")
      .select("id, image_url, storage_path, alt_text, sort_order, is_primary, created_at")
      .eq("business_id", businessId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    return {
      theme: normalizeBusinessPageTheme((business || {}) as Record<string, unknown>),
      images: normalizeGalleryRows((images || []) as Array<Record<string, unknown>>),
      logoUrl: typeof business?.logo_url === "string" ? business.logo_url : null,
      schemaReady: !imagesError,
      errorMessage: imagesError?.message || null,
    };
  } catch (error) {
    return {
      theme: normalizeBusinessPageTheme(),
      images: [],
      logoUrl: null,
      schemaReady: false,
      errorMessage: error instanceof Error ? error.message : "Business page customization is unavailable.",
    };
  }
}
