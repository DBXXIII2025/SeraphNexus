import type { PlatformSettings } from "@/lib/platformSettings";

export const PLATFORM_BRAND_ASSETS_BUCKET = "platform-brand-assets";
export const MAX_PLATFORM_LOGO_BYTES = 5 * 1024 * 1024;

const ALLOWED_PLATFORM_LOGO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
]);

export function isAllowedPlatformLogoType(contentType: string) {
  return ALLOWED_PLATFORM_LOGO_TYPES.has(contentType);
}

function getExtension(fileName: string, contentType: string) {
  const fromName = fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (fromName) {
    return fromName;
  }

  if (contentType === "image/svg+xml") {
    return "svg";
  }

  return contentType.split("/").pop()?.replace("jpeg", "jpg") || "png";
}

export function buildPlatformLogoStoragePath(args: {
  fileName: string;
  contentType: string;
  timestamp?: number;
}) {
  const extension = getExtension(args.fileName, args.contentType);
  return `logos/site-logo-${args.timestamp || Date.now()}.${extension}`;
}

export function resolvePlatformName(settings?: Partial<PlatformSettings> | null) {
  return String(settings?.platform_name || "").trim() || "Seraph Nexus";
}

export function resolvePlatformLogoUrl(settings?: Partial<PlatformSettings> | null) {
  const logoUrl = String(settings?.logo_url || "").trim();
  if (!logoUrl) {
    return null;
  }

  const versionSource = settings?.updated_at || settings?.created_at || "";
  const version = versionSource ? new Date(versionSource).getTime() : Date.now();
  const separator = logoUrl.includes("?") ? "&" : "?";
  return `${logoUrl}${separator}v=${Number.isFinite(version) ? version : Date.now()}`;
}
