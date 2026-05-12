import { canAccessPlanFeature } from "@/lib/planConfig";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { getPlatformAdminSession } from "@/lib/platformAdmin";
import { createAdminClient } from "@/lib/supabase/server";
import { validateDiscountCodePayload } from "@/lib/discountCodes";
import { getAuthorizedConversationForUser, touchConversationAfterMessage } from "@/lib/messages";
import { resolveAccessPlanForBusiness } from "@/lib/accessGrants";
import { getUsageLimitResult } from "@/lib/planEnforcement";
import type { Database } from "@/types/database";

type AssistantMessageRow = Database["public"]["Tables"]["assistant_messages"]["Row"];
type JsonObject = Record<string, unknown>;

type AssistantActionRow =
  Database["public"]["Tables"]["assistant_actions"]["Row"];

type AssistantBusinessRow = Pick<
  Database["public"]["Tables"]["businesses"]["Row"],
  | "id"
  | "name"
  | "business_type"
  | "plan"
  | "is_published"
  | "service_category"
  | "owner_id"
>;

export type AssistantActionType =
  | "draft_client_reply"
  | "draft_service_create"
  | "draft_product_create"
  | "draft_menu_item_create"
  | "draft_promo_code_create"
  | "draft_booking_summary";

export type AssistantActionStatus =
  | "draft"
  | "approved"
  | "rejected"
  | "executed"
  | "failed";

export type AssistantClientReplyPayload = {
  summary: string;
  conversationId: string;
  body: string;
};

export type AssistantServiceCreatePayload = {
  summary: string;
  name: string;
  price: number;
  duration: number;
};

export type AssistantProductCreatePayload = {
  summary: string;
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
};

export type AssistantMenuItemCreatePayload = {
  summary: string;
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
};

export type AssistantPromoCodeCreatePayload = {
  summary: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  applies_to?: "all" | "service" | "rental" | "food" | "product";
  minimum_order_amount_cents?: number | null;
  usage_limit?: number | null;
  starts_at?: string | null;
  expires_at?: string | null;
  active?: boolean;
};

export type AssistantBookingSummaryPayload = {
  summary: string;
  bookingId?: string | null;
  conversationId?: string | null;
  note: string;
};

export type AssistantActionPayload =
  | AssistantClientReplyPayload
  | AssistantServiceCreatePayload
  | AssistantProductCreatePayload
  | AssistantMenuItemCreatePayload
  | AssistantPromoCodeCreatePayload
  | AssistantBookingSummaryPayload;

export type AssistantActionRecord = Pick<
  AssistantActionRow,
  "id" | "business_id" | "user_id" | "action_type" | "status" | "created_at" | "updated_at"
> & {
  payload: AssistantActionPayload;
  result: JsonObject;
};

export type AssistantActionDraft = {
  type: AssistantActionType;
  summary: string;
  payload: AssistantActionPayload;
};

export type AssistantCompletionEnvelope = {
  reply: string;
  action: AssistantActionDraft | null;
};

export type AssistantMessageRecord = Pick<
  AssistantMessageRow,
  "id" | "role" | "content" | "created_at"
> & {
  status?: "pending" | "failed" | "sent";
};

export type AssistantBusinessScope = {
  id: string;
  name: string | null;
  business_type: string | null;
  plan: string | null | undefined;
  is_published: boolean;
  service_category?: string | null;
  owner_id?: string | null;
  access_role?: "owner" | "admin" | "manager" | "staff";
};

export type AssistantContextSummary = {
  businessName: string;
  businessType: string;
  serviceCategory: string | null;
  plan: string;
  published: boolean;
  counts: {
    services: number | null;
    products: number | null;
    rentalsOrProperties: number | null;
    bookingsOrReservations: number | null;
    orders: number | null;
    customerConversationThreads: number | null;
  };
};

export type AssistantAccessResult = {
  userId: string | null;
  isPlatformAdmin: boolean;
  business: AssistantBusinessScope | null;
  canUseAssistant: boolean;
  requiresUpgrade: boolean;
  missingBusinessSelection: boolean;
};

export type AssistantBusinessOption = {
  id: string;
  name: string;
  businessType: string;
  plan: string;
  isPublished: boolean;
};

const MISSING_TABLE_CODES = new Set(["42P01", "42703", "PGRST205"]);
const ALLOWED_ACTION_TYPES = new Set<AssistantActionType>([
  "draft_client_reply",
  "draft_service_create",
  "draft_product_create",
  "draft_menu_item_create",
  "draft_promo_code_create",
  "draft_booking_summary",
]);

function isMissingTableError(error: { code?: string | null } | null | undefined) {
  return Boolean(error?.code && MISSING_TABLE_CODES.has(String(error.code)));
}

function normalizeStoredPlan(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "starter";
}

function normalizeText(value: unknown, maxLength = 5000) {
  const text = String(value || "").trim();
  return text ? text.slice(0, maxLength) : null;
}

function normalizePrice(value: unknown) {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price : null;
}

function normalizeDuration(value: unknown) {
  const duration = Number(value);
  return Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 30;
}

function nowIso() {
  return new Date().toISOString();
}

function extractMissingColumnName(message: string) {
  const patterns = [
    /column ["']([^"']+)["']/i,
    /column\s+([a-zA-Z0-9_.]+)\s+does not exist/i,
    /Could not find the ['"]([^'"]+)['"] column/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      const rawColumn = match[1];
      return rawColumn.includes(".") ? rawColumn.split(".").pop() || rawColumn : rawColumn;
    }
  }

  return null;
}

async function runSchemaSafeMutation(args: {
  payload: Record<string, unknown>;
  requiredColumns?: string[];
  runMutation: (payload: Record<string, unknown>) => Promise<{ error: { message?: string } | null; data?: unknown }>;
}) {
  const candidate = Object.fromEntries(
    Object.entries(args.payload).filter(([, value]) => value !== undefined)
  );
  const requiredColumns = new Set(args.requiredColumns || []);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const result = await args.runMutation(candidate);

    if (!result.error) {
      return result;
    }

    const missingColumn = extractMissingColumnName(result.error.message || "");
    if (!missingColumn || !(missingColumn in candidate)) {
      return result;
    }

    if (requiredColumns.has(missingColumn)) {
      return {
        data: null,
        error: new Error(`Required column is missing: ${missingColumn}`),
      };
    }

    delete candidate[missingColumn];
  }

  return {
    data: null,
    error: new Error("Failed to save record after schema fallback retries"),
  };
}

function normalizeActionRecord(row: AssistantActionRow): AssistantActionRecord {
  return {
    id: row.id,
    business_id: row.business_id,
    user_id: row.user_id,
    action_type: row.action_type as AssistantActionType,
    status: row.status as AssistantActionStatus,
    payload:
      row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? (row.payload as AssistantActionPayload)
        : ({ summary: "" } as AssistantActionPayload),
    result:
      row.result && typeof row.result === "object" && !Array.isArray(row.result)
        ? (row.result as JsonObject)
        : {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function summaryFromPayload(payload: JsonObject) {
  return normalizeText(payload.summary, 240);
}

type PayloadValidationResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: string;
    };

function getObjectRecord(
  payload: unknown,
  invalidMessage: string
): PayloadValidationResult<JsonObject> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      ok: false,
      error: invalidMessage,
    };
  }

  return {
    ok: true,
    value: payload as JsonObject,
  };
}

function findUnsupportedKeys(record: JsonObject, allowedKeys: string[]) {
  const allowed = new Set(allowedKeys);
  return Object.keys(record)
    .filter((key) => !allowed.has(key))
    .sort();
}

function unsupportedFieldsError(fields: string[]) {
  return `This action included unsupported fields: ${fields.join(", ")}.`;
}

function resolveDraftName(record: JsonObject) {
  return normalizeText(record.name, 200) || normalizeText(record.title, 200);
}

function validateClientReplyPayload(payload: unknown): AssistantClientReplyPayload | null {
  const objectResult = getObjectRecord(payload, "This drafted reply payload is invalid.");
  if (!objectResult.ok) {
    return null;
  }

  const record = objectResult.value;
  const unsupported = findUnsupportedKeys(record, ["summary", "conversationId", "body"]);
  if (unsupported.length > 0) {
    return null;
  }
  const summary = summaryFromPayload(record);
  const conversationId = normalizeText(record.conversationId, 120);
  const body = normalizeText(record.body, 4000);

  if (!summary || !conversationId || !body) {
    return null;
  }

  return {
    summary,
    conversationId,
    body,
  };
}

function validateServiceCreatePayload(payload: unknown): AssistantServiceCreatePayload | null {
  const objectResult = getObjectRecord(payload, "This drafted service payload is invalid.");
  if (!objectResult.ok) {
    return null;
  }

  const record = objectResult.value;
  const unsupported = findUnsupportedKeys(record, ["summary", "name", "title", "price", "duration"]);
  if (unsupported.length > 0) {
    return null;
  }
  const summary = summaryFromPayload(record);
  const name = resolveDraftName(record);
  const price = normalizePrice(record.price);

  if (!summary || !name || price === null) {
    return null;
  }

  return {
    summary,
    name,
    price,
    duration: normalizeDuration(record.duration),
  };
}

function validateProductCreatePayload(payload: unknown): AssistantProductCreatePayload | null {
  const objectResult = getObjectRecord(payload, "This drafted product payload is invalid.");
  if (!objectResult.ok) {
    return null;
  }

  const record = objectResult.value;
  const unsupported = findUnsupportedKeys(record, [
    "summary",
    "name",
    "title",
    "description",
    "price",
    "image_url",
  ]);
  if (unsupported.length > 0) {
    return null;
  }
  const summary = summaryFromPayload(record);
  const name = resolveDraftName(record);
  const price = normalizePrice(record.price);

  if (!summary || !name || price === null) {
    return null;
  }

  return {
    summary,
    name,
    description: normalizeText(record.description),
    price,
    image_url: normalizeText(record.image_url, 2000),
  };
}

function validateMenuItemCreatePayload(payload: unknown): AssistantMenuItemCreatePayload | null {
  const objectResult = getObjectRecord(payload, "This drafted menu item payload is invalid.");
  if (!objectResult.ok) {
    return null;
  }

  const record = objectResult.value;
  const unsupported = findUnsupportedKeys(record, [
    "summary",
    "name",
    "title",
    "description",
    "price",
    "image_url",
  ]);
  if (unsupported.length > 0) {
    return null;
  }
  const summary = summaryFromPayload(record);
  const name = resolveDraftName(record);
  const price = normalizePrice(record.price);

  if (!summary || !name || price === null) {
    return null;
  }

  return {
    summary,
    name,
    description: normalizeText(record.description),
    price,
    image_url: normalizeText(record.image_url, 2000),
  };
}

function validatePromoCodeCreatePayload(payload: unknown): AssistantPromoCodeCreatePayload | null {
  const objectResult = getObjectRecord(payload, "This drafted promo code payload is invalid.");
  if (!objectResult.ok) {
    return null;
  }

  const record = objectResult.value;
  const unsupported = findUnsupportedKeys(record, [
    "summary",
    "code",
    "discount_type",
    "discount_value",
    "applies_to",
    "minimum_order_amount_cents",
    "usage_limit",
    "starts_at",
    "expires_at",
    "active",
  ]);
  if (unsupported.length > 0) {
    return null;
  }
  const summary = summaryFromPayload(record);

  if (!summary) {
    return null;
  }

  const parsed = validateDiscountCodePayload(record);
  if (!parsed.ok) {
    return null;
  }

  return {
    summary,
    ...parsed.value,
  };
}

function validateBookingSummaryPayload(payload: unknown): AssistantBookingSummaryPayload | null {
  const objectResult = getObjectRecord(payload, "This drafted booking summary payload is invalid.");
  if (!objectResult.ok) {
    return null;
  }

  const record = objectResult.value;
  const unsupported = findUnsupportedKeys(record, ["summary", "bookingId", "conversationId", "note"]);
  if (unsupported.length > 0) {
    return null;
  }
  const summary = summaryFromPayload(record);
  const note = normalizeText(record.note, 4000);

  if (!summary || !note) {
    return null;
  }

  const bookingId = normalizeText(record.bookingId, 120);
  const conversationId = normalizeText(record.conversationId, 120);

  if (!bookingId && !conversationId) {
    return null;
  }

  return {
    summary,
    note,
    bookingId,
    conversationId,
  };
}

function parseClientReplyPayload(payload: unknown): PayloadValidationResult<AssistantClientReplyPayload> {
  const objectResult = getObjectRecord(payload, "This drafted reply payload is invalid.");
  if (!objectResult.ok) {
    return objectResult;
  }

  const record = objectResult.value;
  const unsupported = findUnsupportedKeys(record, ["summary", "conversationId", "body"]);
  if (unsupported.length > 0) {
    return {
      ok: false,
      error: unsupportedFieldsError(unsupported),
    };
  }

  const summary = summaryFromPayload(record);
  const conversationId = normalizeText(record.conversationId, 120);
  const body = normalizeText(record.body, 4000);

  if (!summary || !conversationId || !body) {
    return {
      ok: false,
      error: "This drafted reply payload is invalid.",
    };
  }

  return {
    ok: true,
    value: {
      summary,
      conversationId,
      body,
    },
  };
}

function parseServiceCreatePayload(
  payload: unknown
): PayloadValidationResult<AssistantServiceCreatePayload> {
  const objectResult = getObjectRecord(payload, "This drafted service payload is invalid.");
  if (!objectResult.ok) {
    return objectResult;
  }

  const record = objectResult.value;
  const unsupported = findUnsupportedKeys(record, ["summary", "name", "title", "price", "duration"]);
  if (unsupported.length > 0) {
    return {
      ok: false,
      error: unsupportedFieldsError(unsupported),
    };
  }

  const summary = summaryFromPayload(record);
  const name = resolveDraftName(record);
  const price = normalizePrice(record.price);

  if (!summary || !name || price === null) {
    return {
      ok: false,
      error: "This drafted service payload is invalid.",
    };
  }

  return {
    ok: true,
    value: {
      summary,
      name,
      price,
      duration: normalizeDuration(record.duration),
    },
  };
}

function parseProductCreatePayload(
  payload: unknown
): PayloadValidationResult<AssistantProductCreatePayload> {
  const objectResult = getObjectRecord(payload, "This drafted product payload is invalid.");
  if (!objectResult.ok) {
    return objectResult;
  }

  const record = objectResult.value;
  const unsupported = findUnsupportedKeys(record, [
    "summary",
    "name",
    "title",
    "description",
    "price",
    "image_url",
  ]);
  if (unsupported.length > 0) {
    return {
      ok: false,
      error: unsupportedFieldsError(unsupported),
    };
  }

  const summary = summaryFromPayload(record);
  const name = resolveDraftName(record);
  const price = normalizePrice(record.price);

  if (!summary || !name || price === null) {
    return {
      ok: false,
      error: "This drafted product payload is invalid.",
    };
  }

  return {
    ok: true,
    value: {
      summary,
      name,
      description: normalizeText(record.description),
      price,
      image_url: normalizeText(record.image_url, 2000),
    },
  };
}

function parseMenuItemCreatePayload(
  payload: unknown
): PayloadValidationResult<AssistantMenuItemCreatePayload> {
  const objectResult = getObjectRecord(payload, "This drafted menu item payload is invalid.");
  if (!objectResult.ok) {
    return objectResult;
  }

  const record = objectResult.value;
  const unsupported = findUnsupportedKeys(record, [
    "summary",
    "name",
    "title",
    "description",
    "price",
    "image_url",
  ]);
  if (unsupported.length > 0) {
    return {
      ok: false,
      error: unsupportedFieldsError(unsupported),
    };
  }

  const summary = summaryFromPayload(record);
  const name = resolveDraftName(record);
  const price = normalizePrice(record.price);

  if (!summary || !name || price === null) {
    return {
      ok: false,
      error: "This drafted menu item payload is invalid.",
    };
  }

  return {
    ok: true,
    value: {
      summary,
      name,
      description: normalizeText(record.description),
      price,
      image_url: normalizeText(record.image_url, 2000),
    },
  };
}

function parsePromoCodeCreatePayload(
  payload: unknown
): PayloadValidationResult<AssistantPromoCodeCreatePayload> {
  const objectResult = getObjectRecord(payload, "This drafted promo code payload is invalid.");
  if (!objectResult.ok) {
    return objectResult;
  }

  const record = objectResult.value;
  const unsupported = findUnsupportedKeys(record, [
    "summary",
    "code",
    "discount_type",
    "discount_value",
    "applies_to",
    "minimum_order_amount_cents",
    "usage_limit",
    "starts_at",
    "expires_at",
    "active",
  ]);
  if (unsupported.length > 0) {
    return {
      ok: false,
      error: unsupportedFieldsError(unsupported),
    };
  }

  const summary = summaryFromPayload(record);
  if (!summary) {
    return {
      ok: false,
      error: "This drafted promo code payload is invalid.",
    };
  }

  const parsed = validateDiscountCodePayload(record);
  if (!parsed.ok) {
    return {
      ok: false,
      error: parsed.error,
    };
  }

  return {
    ok: true,
    value: {
      summary,
      ...parsed.value,
    },
  };
}

function parseBookingSummaryPayload(
  payload: unknown
): PayloadValidationResult<AssistantBookingSummaryPayload> {
  const objectResult = getObjectRecord(payload, "This drafted booking summary payload is invalid.");
  if (!objectResult.ok) {
    return objectResult;
  }

  const record = objectResult.value;
  const unsupported = findUnsupportedKeys(record, ["summary", "bookingId", "conversationId", "note"]);
  if (unsupported.length > 0) {
    return {
      ok: false,
      error: unsupportedFieldsError(unsupported),
    };
  }

  const summary = summaryFromPayload(record);
  const note = normalizeText(record.note, 4000);
  const bookingId = normalizeText(record.bookingId, 120);
  const conversationId = normalizeText(record.conversationId, 120);

  if (!summary || !note || (!bookingId && !conversationId)) {
    return {
      ok: false,
      error: "This drafted booking summary payload is invalid.",
    };
  }

  return {
    ok: true,
    value: {
      summary,
      note,
      bookingId,
      conversationId,
    },
  };
}

export function validateAssistantActionDraft(input: unknown): AssistantActionDraft | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  const record = input as JsonObject;
  const actionType = normalizeText(record.type, 120) as AssistantActionType | null;

  if (!actionType || !ALLOWED_ACTION_TYPES.has(actionType)) {
    return null;
  }

  let payload: AssistantActionPayload | null = null;

  switch (actionType) {
    case "draft_client_reply":
      payload = validateClientReplyPayload(record.payload);
      break;
    case "draft_service_create":
      payload = validateServiceCreatePayload(record.payload);
      break;
    case "draft_product_create":
      payload = validateProductCreatePayload(record.payload);
      break;
    case "draft_menu_item_create":
      payload = validateMenuItemCreatePayload(record.payload);
      break;
    case "draft_promo_code_create":
      payload = validatePromoCodeCreatePayload(record.payload);
      break;
    case "draft_booking_summary":
      payload = validateBookingSummaryPayload(record.payload);
      break;
  }

  if (!payload) {
    return null;
  }

  return {
    type: actionType,
    summary: payload.summary,
    payload,
  };
}

function stripCodeFence(value: string) {
  const trimmed = value.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch?.[1]?.trim() || trimmed;
}

export function parseAssistantCompletion(rawText: string): AssistantCompletionEnvelope {
  const text = stripCodeFence(rawText);

  try {
    const parsed = JSON.parse(text) as {
      reply?: unknown;
      action?: unknown;
    };
    const reply = normalizeText(parsed.reply, 6000);
    const action = validateAssistantActionDraft(parsed.action);

    if (reply) {
      return {
        reply,
        action,
      };
    }
  } catch {}

  return {
    reply: rawText.trim(),
    action: null,
  };
}

export function canManageAssistantActions(input: {
  ownerId?: string | null;
  userId?: string | null;
  accessRole?: string | null;
  isPlatformAdmin?: boolean;
}) {
  if (!input.userId) {
    return false;
  }

  if (input.isPlatformAdmin) {
    return true;
  }

  if (input.ownerId && input.ownerId === input.userId) {
    return true;
  }

  return input.accessRole === "admin" || input.accessRole === "manager";
}

export async function resolveAssistantAccess(
  requestedBusinessId?: string | null
): Promise<AssistantAccessResult> {
  const { user, isPlatformAdmin } = await getPlatformAdminSession();

  if (!user) {
    return {
      userId: null,
      isPlatformAdmin,
      business: null,
      canUseAssistant: false,
      requiresUpgrade: false,
      missingBusinessSelection: false,
    };
  }

  if (isPlatformAdmin) {
    if (!requestedBusinessId) {
      return {
        userId: user.id,
        isPlatformAdmin: true,
        business: null,
        canUseAssistant: true,
        requiresUpgrade: false,
        missingBusinessSelection: true,
      };
    }

    const supabase = createAdminClient();
    const { data } = await supabase
      .from("businesses")
      .select("id,name,business_type,plan,is_published,service_category,owner_id")
      .eq("id", requestedBusinessId)
      .maybeSingle();

    return {
      userId: user.id,
      isPlatformAdmin: true,
      business: data
        ? {
            ...(data as AssistantBusinessRow),
            access_role: "owner",
          }
        : null,
      canUseAssistant: Boolean(data),
      requiresUpgrade: false,
      missingBusinessSelection: false,
    };
  }

  const business = await getActiveBusiness(requestedBusinessId || undefined);
  const canUseAssistant = business ? canAccessPlanFeature(business.plan, "automation") : false;

  return {
    userId: user.id,
    isPlatformAdmin: false,
    business: business
      ? {
          id: business.id,
          name: business.name,
          business_type: business.business_type,
          plan: business.plan,
          is_published: Boolean(business.is_published),
          service_category: business.service_category,
          owner_id: business.owner_id,
          access_role: business.access_role,
        }
      : null,
    canUseAssistant,
    requiresUpgrade: Boolean(business) && !canUseAssistant,
    missingBusinessSelection: false,
  };
}

export async function loadAssistantBusinessOptions(limit = 18) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("businesses")
    .select("id,name,business_type,plan,is_published")
    .order("created_at", { ascending: false })
    .limit(limit);

  return ((data || []) as Array<AssistantBusinessRow>).map((business) => ({
    id: business.id,
    name: business.name || "Untitled business",
    businessType: business.business_type || "business",
    plan: normalizeStoredPlan(business.plan),
    isPublished: Boolean(business.is_published),
  })) satisfies AssistantBusinessOption[];
}

async function safeBusinessCount(table: string, businessId: string) {
  const supabase = createAdminClient() as any;
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);

  if (error) {
    if (!isMissingTableError(error)) {
      console.error("[assistant] count lookup failed", {
        table,
        businessId,
        message: error.message,
        code: error.code,
      });
    }
    return null;
  }

  return typeof count === "number" ? count : 0;
}

export async function buildAssistantContextSummary(
  business: AssistantBusinessScope
): Promise<AssistantContextSummary> {
  const isOrderBusiness =
    business.business_type === "restaurant" ||
    business.business_type === "food" ||
    business.business_type === "store" ||
    business.business_type === "creator" ||
    business.business_type === "product";
  const isRentalBusiness =
    business.business_type === "rental" || business.business_type === "property";

  const [
    servicesCount,
    productsCount,
    propertiesCount,
    bookingsCount,
    reservationsCount,
    ordersCount,
    conversationCount,
  ] = await Promise.all([
    safeBusinessCount("services", business.id),
    safeBusinessCount("products", business.id),
    safeBusinessCount("property", business.id),
    safeBusinessCount("bookings", business.id),
    safeBusinessCount("rental_reservations", business.id),
    safeBusinessCount("orders", business.id),
    safeBusinessCount("conversations", business.id),
  ]);

  return {
    businessName: business.name || "Active business",
    businessType: business.business_type || "business",
    serviceCategory: business.service_category || null,
    plan: normalizeStoredPlan(business.plan),
    published: Boolean(business.is_published),
    counts: {
      services: isOrderBusiness || isRentalBusiness ? null : servicesCount,
      products: isOrderBusiness ? productsCount : null,
      rentalsOrProperties: isRentalBusiness ? propertiesCount : null,
      bookingsOrReservations: isRentalBusiness ? reservationsCount : bookingsCount,
      orders: isOrderBusiness ? ordersCount : null,
      customerConversationThreads: conversationCount,
    },
  };
}

export async function loadAssistantMessages(args: {
  businessId: string;
  userId: string;
  limit?: number;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("assistant_messages")
    .select("id,role,content,created_at")
    .eq("business_id", args.businessId)
    .eq("user_id", args.userId)
    .order("created_at", { ascending: false })
    .limit(args.limit || 40);

  if (error) {
    if (isMissingTableError(error)) {
      return {
        messages: [] as AssistantMessageRecord[],
        storageError:
          "Assistant storage is not installed yet. Apply the assistant_messages migration first.",
      };
    }

    console.error("[assistant] history lookup failed", {
      businessId: args.businessId,
      userId: args.userId,
      message: error.message,
      code: error.code,
    });

    return {
      messages: [] as AssistantMessageRecord[],
      storageError: "Assistant history could not be loaded.",
    };
  }

  return {
    messages: [...((data || []) as AssistantMessageRecord[])].reverse(),
    storageError: null,
  };
}

export async function insertAssistantMessages(args: {
  businessId: string;
  userId: string;
  messages: Array<Pick<AssistantMessageRow, "role" | "content">>;
}) {
  const supabase = createAdminClient();
  const rows = args.messages.map((message) => ({
    business_id: args.businessId,
    user_id: args.userId,
    role: message.role,
    content: message.content,
  }));

  const { data, error } = await supabase
    .from("assistant_messages")
    .insert(rows)
    .select("id,role,content,created_at")
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingTableError(error)) {
      return {
        ok: false as const,
        error:
          "Assistant storage is not installed yet. Apply the assistant_messages migration first.",
      };
    }

    console.error("[assistant] history insert failed", {
      businessId: args.businessId,
      userId: args.userId,
      message: error.message,
      code: error.code,
    });

    return {
      ok: false as const,
      error: "Assistant history could not be saved.",
    };
  }

  return {
    ok: true as const,
    messages: ((data || []) as AssistantMessageRecord[]).map((message) => ({
      ...message,
      status: "sent" as const,
    })),
  };
}

export async function loadAssistantActions(args: {
  businessId: string;
  userId: string;
  limit?: number;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("assistant_actions")
    .select("id,business_id,user_id,action_type,status,payload,result,created_at,updated_at")
    .eq("business_id", args.businessId)
    .eq("user_id", args.userId)
    .order("created_at", { ascending: false })
    .limit(args.limit || 40);

  if (error) {
    if (isMissingTableError(error)) {
      return {
        actions: [] as AssistantActionRecord[],
        storageError:
          "Assistant action storage is not installed yet. Apply the assistant_actions migration first.",
      };
    }

    console.error("[assistant] action history lookup failed", {
      businessId: args.businessId,
      userId: args.userId,
      message: error.message,
      code: error.code,
    });

    return {
      actions: [] as AssistantActionRecord[],
      storageError: "Assistant actions could not be loaded.",
    };
  }

  return {
    actions: ((data || []) as AssistantActionRow[]).map(normalizeActionRecord).reverse(),
    storageError: null,
  };
}

export async function insertAssistantActionDraft(args: {
  businessId: string;
  userId: string;
  action: AssistantActionDraft;
}) {
  const supabase = createAdminClient();
  const row = {
    business_id: args.businessId,
    user_id: args.userId,
    action_type: args.action.type,
    status: "draft",
    payload: args.action.payload,
    result: {},
  };

  const { data, error } = await supabase
    .from("assistant_actions")
    .insert(row)
    .select("id,business_id,user_id,action_type,status,payload,result,created_at,updated_at")
    .maybeSingle();

  if (error || !data) {
    if (isMissingTableError(error)) {
      return {
        ok: false as const,
        error:
          "Assistant action storage is not installed yet. Apply the assistant_actions migration first.",
      };
    }

    console.error("[assistant] action insert failed", {
      businessId: args.businessId,
      userId: args.userId,
      message: error?.message,
      code: error?.code,
    });

    return {
      ok: false as const,
      error: "Assistant action draft could not be saved.",
    };
  }

  return {
    ok: true as const,
    action: normalizeActionRecord(data as AssistantActionRow),
  };
}

export async function getAssistantActionById(id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("assistant_actions")
    .select("id,business_id,user_id,action_type,status,payload,result,created_at,updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      return {
        action: null,
        error:
          "Assistant action storage is not installed yet. Apply the assistant_actions migration first.",
      };
    }

    return {
      action: null,
      error: error.message || "Assistant action could not be loaded.",
    };
  }

  return {
    action: data ? normalizeActionRecord(data as AssistantActionRow) : null,
    error: null,
  };
}

export async function updateAssistantAction(args: {
  id: string;
  status: AssistantActionStatus;
  result?: JsonObject;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("assistant_actions")
    .update({
      status: args.status,
      result: args.result || {},
      updated_at: nowIso(),
    })
    .eq("id", args.id)
    .select("id,business_id,user_id,action_type,status,payload,result,created_at,updated_at")
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false as const,
      error: error?.message || "Assistant action could not be updated.",
    };
  }

  return {
    ok: true as const,
    action: normalizeActionRecord(data as AssistantActionRow),
  };
}

async function enforceCreateLimit(args: {
  table: string;
  business: AssistantBusinessScope;
  userId: string;
  userEmail?: string | null;
  limitKey: "max_services" | "max_products";
}) {
  const supabase = createAdminClient() as any;
  const effectivePlan = await resolveAccessPlanForBusiness({
    business: {
      id: args.business.id,
      owner_id: args.business.owner_id || null,
      plan: args.business.plan || null,
    },
    userId: args.userId,
    email: args.userEmail || null,
  });

  const { count, error } = await supabase
    .from(args.table)
    .select("id", { count: "exact", head: true })
    .eq("business_id", args.business.id);

  if (error) {
    throw new Error(`Could not check ${args.table} limits.`);
  }

  const limit = getUsageLimitResult({
    plan: effectivePlan,
    limitKey: args.limitKey,
    current: Number(count || 0),
  });

  if (!limit.allowed) {
    throw new Error(limit.message || `The active plan cannot add more ${args.table}.`);
  }
}

async function executeDraftClientReply(args: {
  action: AssistantActionRecord;
  business: AssistantBusinessScope;
  userId: string;
}) {
  const payloadResult = parseClientReplyPayload(args.action.payload);

  if (!payloadResult.ok) {
    throw new Error(payloadResult.error);
  }
  const payload = payloadResult.value;

  const access = await getAuthorizedConversationForUser({
    conversationId: payload.conversationId,
    userId: args.userId,
  });

  if (
    !access.conversation?.id ||
    !access.business?.id ||
    access.business.id !== args.business.id ||
    access.role !== "business"
  ) {
    throw new Error("You do not have permission to send that drafted client reply.");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: access.conversation.id,
      sender_user_id: args.userId,
      recipient_user_id: access.conversation.client_user_id || null,
      business_id: access.conversation.business_id,
      body: payload.body,
      is_read: false,
      read_at: null,
    })
    .select("id,conversation_id,business_id,body,created_at")
    .maybeSingle();

  if (error || !data?.id) {
    throw new Error(error?.message || "Failed to send drafted client reply.");
  }

  await touchConversationAfterMessage({
    conversationId: access.conversation.id,
    senderType: "business",
    body: payload.body,
  });

  return {
    messageId: String(data.id),
    conversationId: String(data.conversation_id),
    body: String(data.body || ""),
    created_at: data.created_at ? String(data.created_at) : null,
  };
}

async function executeDraftServiceCreate(args: {
  action: AssistantActionRecord;
  business: AssistantBusinessScope;
  userId: string;
}) {
  const payloadResult = parseServiceCreatePayload(args.action.payload);

  if (!payloadResult.ok) {
    throw new Error(payloadResult.error);
  }
  const payload = payloadResult.value;

  await enforceCreateLimit({
    table: "services",
    business: args.business,
    userId: args.userId,
    limitKey: "max_services",
  });

  const supabase = createAdminClient() as any;
  const servicesTable = supabase.from("services");
  const result = await runSchemaSafeMutation({
    payload: {
      business_id: args.business.id,
      name: payload.name,
      price: payload.price,
      duration: payload.duration,
    },
    requiredColumns: ["business_id", "name", "price", "duration"],
    runMutation: (nextPayload) =>
      servicesTable.insert(nextPayload).select("id,name,price,duration,created_at").single(),
  });

  if (result.error || !result.data) {
    throw new Error(result.error?.message || "Failed to create drafted service.");
  }

  const row = result.data as Record<string, unknown>;
  return {
    serviceId: String(row.id || ""),
    name: String(row.name || payload.name),
    price: Number(row.price || payload.price),
    duration: Number(row.duration || payload.duration),
    created_at: row.created_at ? String(row.created_at) : null,
  };
}

async function executeDraftProductCreate(args: {
  action: AssistantActionRecord;
  business: AssistantBusinessScope;
  userId: string;
}) {
  const payloadResult = parseProductCreatePayload(args.action.payload);

  if (!payloadResult.ok) {
    throw new Error(payloadResult.error);
  }
  const payload = payloadResult.value;

  await enforceCreateLimit({
    table: "products",
    business: args.business,
    userId: args.userId,
    limitKey: "max_products",
  });

  const supabase = createAdminClient() as any;
  const productsTable = supabase.from("products");
  const result = await runSchemaSafeMutation({
    payload: {
      business_id: args.business.id,
      name: payload.name,
      description: payload.description || null,
      price: payload.price,
      image_url: payload.image_url || null,
    },
    requiredColumns: ["business_id", "name", "price"],
    runMutation: (nextPayload) =>
      productsTable.insert(nextPayload).select("id,name,price,image_url,created_at").single(),
  });

  if (result.error || !result.data) {
    throw new Error(result.error?.message || "Failed to create drafted product.");
  }

  const row = result.data as Record<string, unknown>;
  return {
    productId: String(row.id || ""),
    name: String(row.name || payload.name),
    price: Number(row.price || payload.price),
    image_url: row.image_url ? String(row.image_url) : payload.image_url || null,
    created_at: row.created_at ? String(row.created_at) : null,
  };
}

async function executeDraftMenuItemCreate(args: {
  action: AssistantActionRecord;
  business: AssistantBusinessScope;
  userId: string;
}) {
  if (args.business.business_type !== "restaurant" && args.business.business_type !== "food") {
    throw new Error("Menu item drafts can only be approved for restaurant or food workspaces.");
  }

  const payloadResult = parseMenuItemCreatePayload(args.action.payload);

  if (!payloadResult.ok) {
    throw new Error(payloadResult.error);
  }
  const payload = payloadResult.value;

  await enforceCreateLimit({
    table: "menu_items",
    business: args.business,
    userId: args.userId,
    limitKey: "max_products",
  });

  const supabase = createAdminClient() as any;
  const menuItemsTable = supabase.from("menu_items");
  const result = await runSchemaSafeMutation({
    payload: {
      business_id: args.business.id,
      name: payload.name,
      description: payload.description || null,
      price: payload.price,
      image_url: payload.image_url || null,
    },
    requiredColumns: ["business_id", "name", "price"],
    runMutation: (nextPayload) =>
      menuItemsTable.insert(nextPayload).select("id,name,price,image_url,created_at").single(),
  });

  if (result.error || !result.data) {
    throw new Error(result.error?.message || "Failed to create drafted menu item.");
  }

  const row = result.data as Record<string, unknown>;
  return {
    menuItemId: String(row.id || ""),
    name: String(row.name || payload.name),
    price: Number(row.price || payload.price),
    image_url: row.image_url ? String(row.image_url) : payload.image_url || null,
    created_at: row.created_at ? String(row.created_at) : null,
  };
}

async function executeDraftPromoCodeCreate(args: {
  action: AssistantActionRecord;
  business: AssistantBusinessScope;
}) {
  const payloadResult = parsePromoCodeCreatePayload(args.action.payload);

  if (!payloadResult.ok) {
    throw new Error(payloadResult.error);
  }
  const payload = payloadResult.value;

  const insertPayload = {
    business_id: args.business.id,
    code: payload.code,
    discount_type: payload.discount_type,
    discount_value: payload.discount_value,
    applies_to: payload.applies_to || "all",
    minimum_order_amount_cents: payload.minimum_order_amount_cents ?? null,
    usage_limit: payload.usage_limit ?? null,
    starts_at: payload.starts_at ?? null,
    expires_at: payload.expires_at ?? null,
    active: payload.active ?? true,
  };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("discount_codes")
    .insert(insertPayload)
    .select("id,code,discount_type,discount_value,created_at")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || "Failed to create drafted promo code.");
  }

  return {
    promoCodeId: String(data.id),
    code: String(data.code || payload.code),
    discount_type: String(data.discount_type || payload.discount_type),
    discount_value: Number(data.discount_value || payload.discount_value),
    created_at: data.created_at ? String(data.created_at) : null,
  };
}

async function executeDraftBookingSummary(args: {
  action: AssistantActionRecord;
}) {
  const payloadResult = parseBookingSummaryPayload(args.action.payload);

  if (!payloadResult.ok) {
    throw new Error(payloadResult.error);
  }
  const payload = payloadResult.value;

  return {
    note: payload.note,
    bookingId: payload.bookingId || null,
    conversationId: payload.conversationId || null,
    persisted: false,
  };
}

export async function executeAssistantAction(args: {
  action: AssistantActionRecord;
  business: AssistantBusinessScope;
  userId: string;
}) {
  switch (args.action.action_type) {
    case "draft_client_reply":
      return executeDraftClientReply(args);
    case "draft_service_create":
      return executeDraftServiceCreate(args);
    case "draft_product_create":
      return executeDraftProductCreate(args);
    case "draft_menu_item_create":
      return executeDraftMenuItemCreate(args);
    case "draft_promo_code_create":
      return executeDraftPromoCodeCreate(args);
    case "draft_booking_summary":
      return executeDraftBookingSummary(args);
    default:
      throw new Error("This assistant action type cannot be executed.");
  }
}
