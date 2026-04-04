export const SERVICE_IMAGES_BUCKET = "service-images";
export const MAX_SERVICE_IMAGE_BYTES = 4 * 1024 * 1024;
export const SERVICE_IMAGE_ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type ServiceImageRecord = {
  id: string;
  service_id: string;
  business_id: string;
  image_url: string | null;
  storage_path: string | null;
  alt_text: string | null;
  sort_order: number | null;
  is_primary: boolean | null;
  created_at: string | null;
};

export function isAllowedServiceImageType(type: string) {
  return SERVICE_IMAGE_ACCEPTED_TYPES.has(type);
}

export function sanitizeServiceImageFileName(name: string) {
  const ext = name.includes(".") ? name.split(".").pop() || "jpg" : "jpg";
  const base = name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return `${base || "service-image"}.${ext.toLowerCase()}`;
}

export function buildServiceImageStoragePath(args: {
  businessId: string;
  serviceId: string;
  fileName: string;
}) {
  return `businesses/${args.businessId}/services/${args.serviceId}/${Date.now()}-${sanitizeServiceImageFileName(args.fileName)}`;
}

export function sortServiceImages<
  T extends Pick<ServiceImageRecord, "is_primary" | "sort_order" | "created_at">
>(images: T[]) {
  return [...images].sort((a, b) => {
    const primaryDiff = Number(b.is_primary === true) - Number(a.is_primary === true);
    if (primaryDiff !== 0) {
      return primaryDiff;
    }

    const orderDiff = Number(a.sort_order || 0) - Number(b.sort_order || 0);
    if (orderDiff !== 0) {
      return orderDiff;
    }

    return String(a.created_at || "").localeCompare(String(b.created_at || ""));
  });
}

export function getPrimaryServiceImage<
  T extends Pick<ServiceImageRecord, "image_url" | "is_primary" | "sort_order" | "created_at">
>(images: T[]) {
  return sortServiceImages(images)[0] || null;
}
