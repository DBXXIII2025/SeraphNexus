import type { Database, Json } from "@/types/database";

export const DISCOUNT_TYPE_OPTIONS = ["percent", "fixed"] as const;
export const DISCOUNT_APPLIES_TO_OPTIONS = [
  "all",
  "service",
  "rental",
  "food",
  "product",
] as const;

export type DiscountType = (typeof DISCOUNT_TYPE_OPTIONS)[number];
export type DiscountAppliesTo = (typeof DISCOUNT_APPLIES_TO_OPTIONS)[number];

export type DiscountCodeRow = Database["public"]["Tables"]["discount_codes"]["Row"];

export type AppliedDiscount = {
  id: string;
  businessId: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  appliesTo: DiscountAppliesTo;
  minimumOrderAmountCents: number | null;
  usageLimit: number | null;
  usageCount: number;
  startsAt: string | null;
  expiresAt: string | null;
  active: boolean;
  subtotalCents: number;
  discountAmountCents: number;
  finalTotalCents: number;
  usageRecorded?: boolean;
};

type DiscountValidationSuccess = {
  ok: true;
  discount: AppliedDiscount;
};

type DiscountValidationFailure = {
  ok: false;
  error: string;
  code:
    | "DISCOUNT_CODE_REQUIRED"
    | "DISCOUNT_CODE_NOT_FOUND"
    | "DISCOUNT_CODE_INACTIVE"
    | "DISCOUNT_CODE_NOT_STARTED"
    | "DISCOUNT_CODE_EXPIRED"
    | "DISCOUNT_CODE_USAGE_LIMIT"
    | "DISCOUNT_CODE_TYPE_MISMATCH"
    | "DISCOUNT_CODE_MINIMUM"
    | "DISCOUNT_CODE_TOTAL_INVALID";
};

export type DiscountValidationResult =
  | DiscountValidationSuccess
  | DiscountValidationFailure;

export type DiscountCodeAdminPayload = {
  id?: string;
  business_id?: string;
  code?: string;
  discount_type?: string;
  discount_value?: number | string;
  applies_to?: string;
  minimum_order_amount_cents?: number | string | null;
  usage_limit?: number | string | null;
  starts_at?: string | null;
  expires_at?: string | null;
  active?: boolean;
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeDiscountCode(input: unknown) {
  return String(input || "").trim().toUpperCase();
}

export function isDiscountType(input: unknown): input is DiscountType {
  return DISCOUNT_TYPE_OPTIONS.includes(input as DiscountType);
}

export function isDiscountAppliesTo(input: unknown): input is DiscountAppliesTo {
  return DISCOUNT_APPLIES_TO_OPTIONS.includes(input as DiscountAppliesTo);
}

export function formatDiscountAppliesTo(value: DiscountAppliesTo) {
  switch (value) {
    case "service":
      return "Services";
    case "rental":
      return "Rentals";
    case "food":
      return "Food";
    case "product":
      return "Products";
    default:
      return "All";
  }
}

export function parseOptionalInteger(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

export function parseOptionalMoneyToCents(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed * 100);
}

export function parseDateTimeInput(value: unknown) {
  if (!value) {
    return null;
  }

  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

export function validateDiscountCodePayload(payload: DiscountCodeAdminPayload) {
  const code = normalizeDiscountCode(payload.code);
  const discountType = String(payload.discount_type || "").trim().toLowerCase();
  const appliesTo = String(payload.applies_to || "all").trim().toLowerCase();
  const discountValue = toNumber(payload.discount_value);
  const minimumOrderAmountCents = parseOptionalMoneyToCents(
    payload.minimum_order_amount_cents
  );
  const usageLimit = parseOptionalInteger(payload.usage_limit);
  const startsAt = parseDateTimeInput(payload.starts_at);
  const expiresAt = parseDateTimeInput(payload.expires_at);
  const active = payload.active !== false;

  if (!code) {
    return { ok: false as const, error: "Promo code is required." };
  }

  if (!isDiscountType(discountType)) {
    return { ok: false as const, error: "Select a valid discount type." };
  }

  if (!isDiscountAppliesTo(appliesTo)) {
    return { ok: false as const, error: "Select where this promo code applies." };
  }

  if (!Number.isFinite(discountValue) || !discountValue || discountValue <= 0) {
    return { ok: false as const, error: "Enter a valid discount value." };
  }

  if (discountType === "percent" && discountValue > 100) {
    return {
      ok: false as const,
      error: "Percentage discounts must be 100 or less.",
    };
  }

  if (
    payload.minimum_order_amount_cents !== null &&
    payload.minimum_order_amount_cents !== undefined &&
    payload.minimum_order_amount_cents !== "" &&
    minimumOrderAmountCents === null
  ) {
    return {
      ok: false as const,
      error: "Enter a valid minimum order amount.",
    };
  }

  if (
    payload.usage_limit !== null &&
    payload.usage_limit !== undefined &&
    payload.usage_limit !== "" &&
    (usageLimit === null || usageLimit <= 0)
  ) {
    return { ok: false as const, error: "Usage limit must be greater than zero." };
  }

  if (payload.starts_at && !startsAt) {
    return { ok: false as const, error: "Start date is invalid." };
  }

  if (payload.expires_at && !expiresAt) {
    return { ok: false as const, error: "Expiration date is invalid." };
  }

  if (startsAt && expiresAt && new Date(expiresAt) <= new Date(startsAt)) {
    return {
      ok: false as const,
      error: "Expiration must be later than the start date.",
    };
  }

  return {
    ok: true as const,
    value: {
      code,
      discount_type: discountType,
      discount_value: Number(discountValue.toFixed(2)),
      applies_to: appliesTo,
      minimum_order_amount_cents: minimumOrderAmountCents,
      usage_limit: usageLimit,
      starts_at: startsAt,
      expires_at: expiresAt,
      active,
    },
  };
}

function coerceDiscountRow(row: DiscountCodeRow | Record<string, unknown>) {
  const record = row as Record<string, unknown>;
  const discountType = String(record.discount_type || "").trim().toLowerCase();
  const appliesTo = String(record.applies_to || "all").trim().toLowerCase();

  if (!isDiscountType(discountType) || !isDiscountAppliesTo(appliesTo)) {
    return null;
  }

  const discountValue = Number(record.discount_value ?? 0);
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    return null;
  }

  return {
    id: String(record.id || ""),
    business_id: String(record.business_id || ""),
    code: normalizeDiscountCode(record.code),
    discount_type: discountType,
    discount_value: discountValue,
    applies_to: appliesTo,
    minimum_order_amount_cents:
      record.minimum_order_amount_cents === null ||
      record.minimum_order_amount_cents === undefined
        ? null
        : Number(record.minimum_order_amount_cents),
    usage_limit:
      record.usage_limit === null || record.usage_limit === undefined
        ? null
        : Number(record.usage_limit),
    usage_count: Number(record.usage_count || 0),
    starts_at: record.starts_at ? String(record.starts_at) : null,
    expires_at: record.expires_at ? String(record.expires_at) : null,
    active: record.active !== false,
    created_at: record.created_at ? String(record.created_at) : new Date().toISOString(),
  };
}

function calculateDiscountAmountCents(args: {
  subtotalCents: number;
  discountType: DiscountType;
  discountValue: number;
}) {
  if (args.discountType === "percent") {
    return Math.round(args.subtotalCents * (args.discountValue / 100));
  }

  return Math.round(args.discountValue * 100);
}

export async function validateDiscountForCheckout(args: {
  supabaseAdmin: {
    from: (table: "discount_codes") => any;
  };
  businessId: string;
  code: string;
  checkoutType: Exclude<DiscountAppliesTo, "all">;
  subtotalCents: number;
  now?: Date;
}): Promise<DiscountValidationResult> {
  const normalizedCode = normalizeDiscountCode(args.code);
  if (!normalizedCode) {
    return {
      ok: false,
      error: "Enter a promo code to continue.",
      code: "DISCOUNT_CODE_REQUIRED",
    };
  }

  if (!Number.isFinite(args.subtotalCents) || args.subtotalCents <= 0) {
    return {
      ok: false,
      error: "A valid subtotal is required before applying a promo code.",
      code: "DISCOUNT_CODE_TOTAL_INVALID",
    };
  }

  const { data, error } = await args.supabaseAdmin
    .from("discount_codes")
    .select("*")
    .eq("business_id", args.businessId)
    .eq("code", normalizedCode)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to validate promo code");
  }

  const row = data ? coerceDiscountRow(data as DiscountCodeRow) : null;
  if (!row) {
    return {
      ok: false,
      error: "Promo code not found for this business.",
      code: "DISCOUNT_CODE_NOT_FOUND",
    };
  }

  if (!row.active) {
    return {
      ok: false,
      error: "This promo code is inactive.",
      code: "DISCOUNT_CODE_INACTIVE",
    };
  }

  const now = args.now || new Date();
  if (row.starts_at && new Date(row.starts_at) > now) {
    return {
      ok: false,
      error: "This promo code is not active yet.",
      code: "DISCOUNT_CODE_NOT_STARTED",
    };
  }

  if (row.expires_at && new Date(row.expires_at) <= now) {
    return {
      ok: false,
      error: "This promo code has expired.",
      code: "DISCOUNT_CODE_EXPIRED",
    };
  }

  if (row.usage_limit !== null && row.usage_count >= row.usage_limit) {
    return {
      ok: false,
      error: "This promo code has reached its usage limit.",
      code: "DISCOUNT_CODE_USAGE_LIMIT",
    };
  }

  if (row.applies_to !== "all" && row.applies_to !== args.checkoutType) {
    return {
      ok: false,
      error: "This promo code does not apply to this checkout.",
      code: "DISCOUNT_CODE_TYPE_MISMATCH",
    };
  }

  if (
    row.minimum_order_amount_cents !== null &&
    args.subtotalCents < row.minimum_order_amount_cents
  ) {
    return {
      ok: false,
      error: "This promo code requires a higher order total.",
      code: "DISCOUNT_CODE_MINIMUM",
    };
  }

  const rawDiscountAmountCents = calculateDiscountAmountCents({
    subtotalCents: args.subtotalCents,
    discountType: row.discount_type,
    discountValue: row.discount_value,
  });
  const discountAmountCents = Math.max(
    0,
    Math.min(args.subtotalCents, rawDiscountAmountCents)
  );
  const finalTotalCents = Math.max(0, args.subtotalCents - discountAmountCents);

  return {
    ok: true,
    discount: {
      id: row.id,
      businessId: row.business_id,
      code: row.code,
      discountType: row.discount_type,
      discountValue: row.discount_value,
      appliesTo: row.applies_to,
      minimumOrderAmountCents: row.minimum_order_amount_cents,
      usageLimit: row.usage_limit,
      usageCount: row.usage_count,
      startsAt: row.starts_at,
      expiresAt: row.expires_at,
      active: row.active,
      subtotalCents: args.subtotalCents,
      discountAmountCents,
      finalTotalCents,
      usageRecorded: false,
    },
  };
}

export function serializeAppliedDiscount(
  discount: AppliedDiscount | null | undefined
): Json | null {
  if (!discount) {
    return null;
  }

  return {
    id: discount.id,
    business_id: discount.businessId,
    code: discount.code,
    discount_type: discount.discountType,
    discount_value: discount.discountValue,
    applies_to: discount.appliesTo,
    minimum_order_amount_cents: discount.minimumOrderAmountCents,
    usage_limit: discount.usageLimit,
    usage_count: discount.usageCount,
    starts_at: discount.startsAt,
    expires_at: discount.expiresAt,
    active: discount.active,
    subtotal_cents: discount.subtotalCents,
    discount_amount_cents: discount.discountAmountCents,
    final_total_cents: discount.finalTotalCents,
    usage_recorded: discount.usageRecorded === true,
  } satisfies Record<string, Json>;
}

export function readAppliedDiscount(value: unknown): AppliedDiscount | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const discountType = String(record.discount_type || "").trim().toLowerCase();
  const appliesTo = String(record.applies_to || "").trim().toLowerCase();

  if (!isDiscountType(discountType) || !isDiscountAppliesTo(appliesTo)) {
    return null;
  }

  const id = String(record.id || "").trim();
  const businessId = String(record.business_id || "").trim();
  const code = normalizeDiscountCode(record.code);
  const discountValue = Number(record.discount_value ?? 0);
  const subtotalCents = Number(record.subtotal_cents ?? 0);
  const discountAmountCents = Number(record.discount_amount_cents ?? 0);
  const finalTotalCents = Number(record.final_total_cents ?? 0);

  if (!id || !businessId || !code) {
    return null;
  }

  if (
    !Number.isFinite(discountValue) ||
    !Number.isFinite(subtotalCents) ||
    !Number.isFinite(discountAmountCents) ||
    !Number.isFinite(finalTotalCents)
  ) {
    return null;
  }

  return {
    id,
    businessId,
    code,
    discountType,
    discountValue,
    appliesTo,
    minimumOrderAmountCents:
      record.minimum_order_amount_cents === null ||
      record.minimum_order_amount_cents === undefined
        ? null
        : Number(record.minimum_order_amount_cents),
    usageLimit:
      record.usage_limit === null || record.usage_limit === undefined
        ? null
        : Number(record.usage_limit),
    usageCount: Number(record.usage_count || 0),
    startsAt: record.starts_at ? String(record.starts_at) : null,
    expiresAt: record.expires_at ? String(record.expires_at) : null,
    active: record.active !== false,
    subtotalCents,
    discountAmountCents,
    finalTotalCents,
    usageRecorded: record.usage_recorded === true,
  };
}
