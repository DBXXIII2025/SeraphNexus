import type { SupabaseClient } from "@supabase/supabase-js";

export const BUSINESS_PAGE_IMAGES_BUCKET = "business-page-images";
export const MAX_BUSINESS_PAGE_IMAGE_BYTES = 5 * 1024 * 1024;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DEFAULT_THEME = {
  accentColor: "#2563eb",
  textColor: "#111827",
  headingFontSize: 36,
  bodyFontSize: 16,
};

export type BusinessPageImage = {
  id: string;
  image_url: string;
  storage_path: string | null;
  alt_text: string | null;
  sort_order: number;
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

export function normalizeBusinessPageTheme(data: Record<string, unknown> = {}): BusinessPageTheme {
  const textColor = normalizeHexColor(data.page_text_color, DEFAULT_THEME.textColor);
  const safeTextColor = contrastRatio(textColor, "#ffffff") >= 4.5 ? textColor : DEFAULT_THEME.textColor;
  const accentColor = normalizeHexColor(data.page_accent_color, DEFAULT_THEME.accentColor);

  return {
    accentColor,
    textColor: safeTextColor,
    headingFontSize: clampNumber(
      data.page_heading_font_size,
      24,
      56,
      DEFAULT_THEME.headingFontSize
    ),
    bodyFontSize: clampNumber(data.page_body_font_size, 14, 20, DEFAULT_THEME.bodyFontSize),
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

export async function loadBusinessPageCustomization(
  supabase: SupabaseClient,
  businessId: string
): Promise<BusinessPageCustomization> {
  try {
    const [{ data: business, error: businessError }, { data: images, error: imagesError }] =
      await Promise.all([
        supabase
          .from("businesses")
          .select("logo_url, page_accent_color, page_text_color, page_heading_font_size, page_body_font_size")
          .eq("id", businessId)
          .maybeSingle(),
        supabase
          .from("business_page_images")
          .select("id, image_url, storage_path, alt_text, sort_order")
          .eq("business_id", businessId)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);

    if (businessError || imagesError) {
      return {
        theme: normalizeBusinessPageTheme(),
        images: [],
        logoUrl: null,
        schemaReady: false,
        errorMessage: businessError?.message || imagesError?.message || "Business page customization is unavailable.",
      };
    }

    return {
      theme: normalizeBusinessPageTheme((business || {}) as Record<string, unknown>),
      images: ((images || []) as BusinessPageImage[]).filter((image) => Boolean(image.image_url)),
      logoUrl: typeof business?.logo_url === "string" ? business.logo_url : null,
      schemaReady: true,
      errorMessage: null,
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
