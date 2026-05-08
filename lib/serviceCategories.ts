export const SERVICE_CATEGORY_OPTIONS = [
  { value: "hvac", label: "HVAC" },
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "handyman", label: "Handyman" },
  { value: "lawn_care", label: "Lawn Care" },
  { value: "cleaning", label: "Cleaning" },
  { value: "nail_tech", label: "Nail Tech" },
  { value: "massage_therapy", label: "Massage Therapy" },
  { value: "hair_barber", label: "Hair / Barber" },
  { value: "beauty_spa", label: "Beauty / Spa" },
  { value: "auto_detailing", label: "Auto Detailing" },
  { value: "appliance_repair", label: "Appliance Repair" },
  { value: "pest_control", label: "Pest Control" },
  { value: "mobile_mechanic", label: "Mobile Mechanic" },
  { value: "personal_training", label: "Personal Training" },
  { value: "photography", label: "Photography" },
  { value: "other", label: "Other" },
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORY_OPTIONS)[number]["value"];

const SERVICE_CATEGORY_LABELS = new Map(
  SERVICE_CATEGORY_OPTIONS.map((option) => [option.value, option.label])
);

export function isServiceCategory(value: unknown): value is ServiceCategory {
  return typeof value === "string" && SERVICE_CATEGORY_LABELS.has(value as ServiceCategory);
}

export function normalizeServiceCategory(value: unknown): ServiceCategory | null {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\/\s-]+/g, "_");

  if (!normalized) {
    return null;
  }

  return isServiceCategory(normalized) ? normalized : null;
}

export function formatServiceCategory(value: unknown) {
  const normalized = normalizeServiceCategory(value);
  return normalized ? SERVICE_CATEGORY_LABELS.get(normalized) || "Other" : null;
}

export function resolveServiceCategoryForBusiness(args: {
  businessType: string;
  value: unknown;
  defaultToOther?: boolean;
}) {
  if (args.businessType !== "service") {
    return null;
  }

  const normalized = normalizeServiceCategory(args.value);
  if (normalized) {
    return normalized;
  }

  return args.defaultToOther ? "other" : null;
}

export function isMissingServiceCategoryColumnError(error: {
  code?: string | null;
  message?: string | null;
} | null) {
  const message = error?.message || "";
  return error?.code === "42703" && message.includes("service_category");
}
