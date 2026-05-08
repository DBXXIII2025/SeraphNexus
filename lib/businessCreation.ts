import { isBusinessType } from "@/lib/businessModules";
import { normalizeBusinessPlan, type PlanTier } from "@/lib/planConfig";
import {
  isMissingServiceCategoryColumnError,
  resolveServiceCategoryForBusiness,
} from "@/lib/serviceCategories";
import { ensureUniqueSlug, slugify } from "@/lib/slug";

type BusinessesTable = {
  select: (columns: string) => {
    eq: (column: string, value: unknown) => ReturnType<
      BusinessesTable["select"]
    >;
    maybeSingle: () => Promise<{
      data: Record<string, unknown> | null;
      error: {
        message?: string;
        details?: string | null;
        hint?: string | null;
        code?: string | null;
      } | null;
    }>;
  };
  insert: (payload: {
    owner_id: string;
    name: string;
    slug: string;
    business_type: string;
    service_category?: string | null;
    plan: string;
    is_published: boolean;
  }) => {
    select: (columns?: string) => {
      single: () => Promise<{
        data: Record<string, unknown> | null;
        error: {
          message?: string;
          details?: string | null;
          hint?: string | null;
          code?: string | null;
        } | null;
      }>;
    };
  };
};

type SupabaseWithBusinesses = {
  from: (table: "businesses") => unknown;
};

const BAD_REQUEST_ERRORS = new Set([
  "Business name is required",
  "Invalid business type",
  "Invalid slug or business name",
  "Reserved fake/test business names are blocked in production flows",
]);

function isReservedNonProductionLabel(value: string) {
  return /\b(verify|test|testing|smoke|demo|sample|placeholder|fake|mock|seed|fixture)\b/i.test(
    value
  );
}

export type CreatedBusiness = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  business_type: string;
  plan: PlanTier;
  is_published: boolean | null;
};

function asString(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function asBoolean(value: unknown) {
  return value === true;
}

function isUniqueConstraintError(error: {
  message?: string;
  code?: string | null;
} | null) {
  if (!error) {
    return false;
  }

  return error.code === "23505" || /duplicate key|unique/i.test(error.message || "");
}

export function getBusinessCreationErrorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (BAD_REQUEST_ERRORS.has(message)) {
    return 400;
  }

  if (message === "Could not reserve a unique slug. Please try again.") {
    return 409;
  }

  return 500;
}

export function normalizeBusinessCreationInput(input: {
  name?: unknown;
  business_type?: unknown;
  slug?: unknown;
  service_category?: unknown;
}) {
  const name = asString(input.name);
  const businessType = asString(input.business_type);
  const requestedSlug = asString(input.slug);
  const serviceCategory = resolveServiceCategoryForBusiness({
    businessType,
    value: input.service_category,
    defaultToOther: true,
  });

  if (!name) {
    throw new Error("Business name is required");
  }

  if (!isBusinessType(businessType)) {
    throw new Error("Invalid business type");
  }

  const baseSlug = slugify(requestedSlug || name);
  if (!baseSlug) {
    throw new Error("Invalid slug or business name");
  }

  // Production business creation must not mint fake/demo tenants unless the
  // operator explicitly opts into that unsafe behavior outside normal flows.
  if (
    process.env.SERAPH_ALLOW_FAKE_BUSINESSES !== "1" &&
    (isReservedNonProductionLabel(name) || isReservedNonProductionLabel(baseSlug))
  ) {
    throw new Error("Reserved fake/test business names are blocked in production flows");
  }

  return {
    name,
    businessType,
    baseSlug,
    serviceCategory,
  };
}

export async function createBusinessRecord(args: {
  supabase: SupabaseWithBusinesses;
  ownerUserId: string;
  name: string;
  businessType: string;
  baseSlug: string;
  serviceCategory?: string | null;
}) {
  const businessesTable = args.supabase.from("businesses") as BusinessesTable;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = await ensureUniqueSlug(businessesTable, args.baseSlug);
    const insertPayload = {
      owner_id: args.ownerUserId,
      name: args.name,
      slug,
      business_type: args.businessType,
      service_category: args.serviceCategory || null,
      plan: "inactive",
      is_published: false,
    };

    let insertQuery = businessesTable
      .insert(insertPayload)
      .select("id,owner_id,name,slug,business_type,plan,is_published")
      .single();

    let { data, error } = await insertQuery;

    if (error && isMissingServiceCategoryColumnError(error)) {
      delete insertPayload.service_category;
      insertQuery = businessesTable
        .insert(insertPayload)
        .select("id,owner_id,name,slug,business_type,plan,is_published")
        .single();
      ({ data, error } = await insertQuery);
    }

    if (!error && data) {
      return {
        id: asString(data.id),
        owner_id: asString(data.owner_id),
        name: asString(data.name),
        slug: asString(data.slug),
        business_type: asString(data.business_type),
        plan: normalizeBusinessPlan(data.plan),
        is_published:
          typeof data.is_published === "boolean"
            ? data.is_published
            : asBoolean(data.is_published),
      } satisfies CreatedBusiness;
    }

    if (!isUniqueConstraintError(error)) {
      throw new Error(error?.message || "Failed to create business");
    }
  }

  throw new Error("Could not reserve a unique slug. Please try again.");
}

export function buildBusinessOnboardingPath(businessId: string) {
  const params = new URLSearchParams({
    businessId,
  });

  return `/onboarding?${params.toString()}`;
}
