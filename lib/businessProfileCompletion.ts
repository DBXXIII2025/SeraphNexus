type ProfileFieldStatus = {
  key: string;
  label: string;
  required: boolean;
  missing: boolean;
};

export type BusinessProfileInput = {
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  business_type?: string | null;
};

export type BusinessProfileCompletion = {
  fields: ProfileFieldStatus[];
  missingRequired: ProfileFieldStatus[];
  missingRecommended: ProfileFieldStatus[];
  completedCount: number;
  totalCount: number;
  progressPercent: number;
  canRenderPublicProfile: boolean;
  canPublishProfile: boolean;
  summary: string;
};

function hasValue(value: string | null | undefined) {
  return typeof value === "string" ? value.trim().length > 0 : false;
}

export function normalizeBusinessSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);
}

export function getBusinessProfileCompletion(
  input: BusinessProfileInput
): BusinessProfileCompletion {
  const fields: ProfileFieldStatus[] = [
    {
      key: "name",
      label: "Business name",
      required: true,
      missing: !hasValue(input.name),
    },
    {
      key: "slug",
      label: "Public slug",
      required: true,
      missing: !hasValue(input.slug),
    },
    {
      key: "description",
      label: "Business description",
      required: true,
      missing: !hasValue(input.description),
    },
  ];

  const missingRequired = fields.filter((field) => field.required && field.missing);
  const missingRecommended = fields.filter((field) => !field.required && field.missing);
  const completedCount = fields.filter((field) => !field.missing).length;
  const totalCount = fields.length;
  const progressPercent =
    totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  const canRenderPublicProfile = missingRequired.length === 0;

  let summary = "Your public-facing business profile is ready.";
  if (!canRenderPublicProfile) {
    summary = `Add ${missingRequired
      .map((field) => field.label.toLowerCase())
      .join(", ")} so your public page has the core business details customers expect.`;
  } else if (missingRecommended.length > 0) {
    summary = `Your profile can go live, but ${missingRecommended
      .map((field) => field.label.toLowerCase())
      .join(", ")} is still missing.`;
  }

  return {
    fields,
    missingRequired,
    missingRecommended,
    completedCount,
    totalCount,
    progressPercent,
    canRenderPublicProfile,
    canPublishProfile: canRenderPublicProfile,
    summary,
  };
}
