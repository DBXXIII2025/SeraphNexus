import type { Json } from "@/types/database";
import type { StructuredIconName } from "@/components/icons/StructuredIcon";

export type PropertyAmenityKey =
  | "washer"
  | "dryer"
  | "dishwasher"
  | "petsAllowed"
  | "wifi"
  | "airConditioning"
  | "heating"
  | "parking"
  | "furnished"
  | "kitchen"
  | "pool"
  | "hotTub"
  | "gym"
  | "smokingAllowed"
  | "smokingNotAllowed"
  | "balcony"
  | "workspace"
  | "tv";

export type PropertyAmenityData = {
  bedrooms: number | null;
  bathrooms: number | null;
} & Record<PropertyAmenityKey, boolean>;

export type PropertyAmenityDefinition = {
  key: PropertyAmenityKey;
  label: string;
  icon: StructuredIconName;
};

export const PROPERTY_AMENITY_DEFINITIONS: PropertyAmenityDefinition[] = [
  { key: "washer", label: "Washer", icon: "washer" },
  { key: "dryer", label: "Dryer", icon: "dryer" },
  { key: "dishwasher", label: "Dishwasher", icon: "dishwasher" },
  { key: "petsAllowed", label: "Pets allowed", icon: "pets" },
  { key: "wifi", label: "Wi-Fi", icon: "wifi" },
  { key: "airConditioning", label: "Air conditioning", icon: "air" },
  { key: "heating", label: "Heating", icon: "heating" },
  { key: "parking", label: "Parking", icon: "parking" },
  { key: "furnished", label: "Furnished", icon: "furnished" },
  { key: "kitchen", label: "Kitchen", icon: "kitchen" },
  { key: "pool", label: "Pool", icon: "pool" },
  { key: "hotTub", label: "Hot tub", icon: "hotTub" },
  { key: "gym", label: "Gym", icon: "gym" },
  { key: "smokingAllowed", label: "Smoking allowed", icon: "smokingAllowed" },
  { key: "smokingNotAllowed", label: "Smoking not allowed", icon: "smokingNotAllowed" },
  { key: "balcony", label: "Balcony", icon: "balcony" },
  { key: "workspace", label: "Dedicated workspace", icon: "workspace" },
  { key: "tv", label: "TV", icon: "tv" },
];

export const PROPERTY_AMENITY_BOOLEAN_KEYS = PROPERTY_AMENITY_DEFINITIONS.map(
  (definition) => definition.key
) as PropertyAmenityKey[];

export const EMPTY_PROPERTY_AMENITY_DATA: PropertyAmenityData = {
  bedrooms: null,
  bathrooms: null,
  washer: false,
  dryer: false,
  dishwasher: false,
  petsAllowed: false,
  wifi: false,
  airConditioning: false,
  heating: false,
  parking: false,
  furnished: false,
  kitchen: false,
  pool: false,
  hotTub: false,
  gym: false,
  smokingAllowed: false,
  smokingNotAllowed: false,
  balcony: false,
  workspace: false,
  tv: false,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeCount(value: unknown, allowHalfStep = false) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const count = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(count) || count < 0) {
    return null;
  }

  const next = allowHalfStep ? Math.round(count * 2) / 2 : Math.round(count);
  return next <= 99 ? next : 99;
}

function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "on" || normalized === "yes";
  }

  if (typeof value === "number") {
    return value === 1;
  }

  return false;
}

export function normalizePropertyAmenityData(value: unknown): PropertyAmenityData {
  const record = asRecord(value);
  const next: PropertyAmenityData = {
    ...EMPTY_PROPERTY_AMENITY_DATA,
    bedrooms: normalizeCount(record?.bedrooms),
    bathrooms: normalizeCount(record?.bathrooms, true),
  };

  for (const key of PROPERTY_AMENITY_BOOLEAN_KEYS) {
    next[key] = normalizeBoolean(record?.[key]);
  }

  if (next.smokingAllowed) {
    next.smokingNotAllowed = false;
  }

  return next;
}

export function toPropertyAmenityJson(value: PropertyAmenityData): Json {
  return value as unknown as Json;
}

export function getEnabledPropertyAmenities(value: unknown) {
  const amenityData = normalizePropertyAmenityData(value);
  return PROPERTY_AMENITY_DEFINITIONS.filter((definition) => amenityData[definition.key]);
}

export function formatAmenityCount(count: number | null, label: string) {
  if (count === null || count <= 0) {
    return null;
  }

  const suffix = count === 1 ? label : `${label}s`;
  return `${count} ${suffix}`;
}
