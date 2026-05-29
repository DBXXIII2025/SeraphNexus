import { canAccessPlanFeature } from "@/lib/planConfig";
import { getBusinessProfileCompletion } from "@/lib/businessProfileCompletion";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { getPlatformAdminSession } from "@/lib/platformAdmin";
import { createAdminClient } from "@/lib/supabase/server";
import { validateDiscountCodePayload } from "@/lib/discountCodes";
import {
  formatConversationTag,
  getAdminConversationSummaries,
  touchConversationAfterMessage,
} from "@/lib/messages";
import { resolveAccessPlanForBusiness } from "@/lib/accessGrants";
import { getUsageLimitResult } from "@/lib/planEnforcement";
import type { Database } from "@/types/database";

type AssistantMessageRow = Database["public"]["Tables"]["assistant_messages"]["Row"];
type JsonObject = Record<string, unknown>;

type AssistantActionRow =
  Database["public"]["Tables"]["assistant_actions"]["Row"];
type AssistantConversationRow =
  Database["public"]["Tables"]["assistant_conversations"]["Row"];
type AssistantMemorySummaryRow =
  Database["public"]["Tables"]["assistant_memory_summaries"]["Row"];

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

export type AssistantConversationStatus = "active" | "archived" | "cleared";

export type AssistantClientReplyPayload = {
  summary: string;
  conversationId: string;
  conversationTag?: string | null;
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
  | "id"
  | "business_id"
  | "user_id"
  | "assistant_conversation_id"
  | "action_type"
  | "status"
  | "created_at"
  | "updated_at"
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
  "id" | "assistant_conversation_id" | "role" | "content" | "created_at"
> & {
  status?: "pending" | "failed" | "sent";
};

export type AssistantConversationRecord = Pick<
  AssistantConversationRow,
  "id" | "title" | "status" | "created_at" | "updated_at" | "last_message_at"
> & {
  latestPreview: string | null;
};

export type AssistantMemoryBlock = {
  conversationId: string;
  title: string;
  status: AssistantConversationStatus;
  summary: string;
  topics: string[];
  updatedAt: string;
};

export type AssistantMemorySummaryRecord = {
  id: string;
  conversationId: string;
  conversationTitle: string;
  conversationStatus: AssistantConversationStatus;
  summary: string;
  topics: string[];
  updatedAt: string;
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
  effectivePlan: string;
  published: boolean;
  counts: {
    services: number | null;
    products: number | null;
    rentalsOrProperties: number | null;
    bookingsOrReservations: number | null;
    orders: number | null;
    customerConversationThreads: number | null;
  };
  metrics: {
    activePromoCodes: number;
    unreadMessages: number;
    openConversations: number;
    upcomingItems: number;
    recentCustomerActivity: number;
  };
  revenue: {
    last30DaysGross: number | null;
    paidTransactions: number;
    windowLabel: string;
  };
  recentActivitySummary: Array<{
    id: string;
    label: string;
    detail: string;
    href: string | null;
  }>;
  insights: Array<{
    id: string;
    title: string;
    detail: string;
    href: string | null;
    tone: "default" | "warning" | "success";
  }>;
  recommendedNextSteps: Array<{
    id: string;
    label: string;
    detail: string;
    href: string | null;
  }>;
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

export type AssistantConversationSelection = {
  selectedConversation: AssistantConversationRecord | null;
  conversations: AssistantConversationRecord[];
  storageError: string | null;
};

export type AssistantMemorySummaryLoadResult = {
  memories: AssistantMemorySummaryRecord[];
  storageError: string | null;
};

const MISSING_TABLE_CODES = new Set(["42P01", "42703", "PGRST205"]);
const ASSISTANT_CONVERSATION_SETUP_ERROR =
  "Seravelle conversation storage is not installed yet. Apply the assistant conversation migration first.";
const ALLOWED_ACTION_TYPES = new Set<AssistantActionType>([
  "draft_client_reply",
  "draft_service_create",
  "draft_product_create",
  "draft_menu_item_create",
  "draft_promo_code_create",
  "draft_booking_summary",
]);
const MEMORY_RECALL_PATTERNS = [
  /\brecall\b/i,
  /\bremember\b/i,
  /\bprevious\b/i,
  /\bearlier\b/i,
  /\bbefore\b/i,
  /\blast week\b/i,
  /\blast month\b/i,
  /\bwe discussed\b/i,
  /\bwe talked about\b/i,
  /\bwhat did we\b/i,
];
const MEMORY_STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "already",
  "also",
  "and",
  "been",
  "before",
  "could",
  "from",
  "have",
  "into",
  "just",
  "last",
  "like",
  "made",
  "more",
  "need",
  "that",
  "them",
  "then",
  "they",
  "this",
  "those",
  "what",
  "when",
  "where",
  "which",
  "with",
  "would",
  "your",
  "seravelle",
  "workspace",
  "business",
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

function isUuid(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function normalizeConversationTitle(value: unknown) {
  const title = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  return title ? title.slice(0, 120) : null;
}

function truncateText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1).trimEnd()}…` : value;
}

function buildConversationTitleFromText(value: string | null | undefined) {
  const normalized = normalizeConversationTitle(value);
  return normalized ? truncateText(normalized, 72) : "Untitled conversation";
}

function extractKeywordTokens(value: string, limit = 8) {
  const tokens = Array.from(
    new Set(
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]+/g, " ")
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(
          (token) =>
            token.length >= 3 &&
            !MEMORY_STOP_WORDS.has(token) &&
            !/^\d+$/.test(token)
        )
    )
  );

  return tokens.slice(0, limit);
}

function shouldRetrieveAssistantMemory(message: string) {
  return MEMORY_RECALL_PATTERNS.some((pattern) => pattern.test(message));
}

function getTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
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
    assistant_conversation_id: row.assistant_conversation_id,
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

function normalizeConversationRecord(
  row: AssistantConversationRow,
  latestPreview: string | null
): AssistantConversationRecord {
  return {
    id: row.id,
    title: row.title,
    status: row.status as AssistantConversationStatus,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_message_at: row.last_message_at,
    latestPreview,
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
  const unsupported = findUnsupportedKeys(record, [
    "summary",
    "conversationId",
    "conversationTag",
    "body",
  ]);
  if (unsupported.length > 0) {
    return null;
  }
  const summary = summaryFromPayload(record);
  const conversationId = normalizeText(record.conversationId, 120);
  const conversationTag = normalizeText(record.conversationTag, 40);
  const body = normalizeText(record.body, 4000);

  if (!summary || !conversationId || !body || !isUuid(conversationId)) {
    return null;
  }

  return {
    summary,
    conversationId,
    conversationTag,
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
  const unsupported = findUnsupportedKeys(record, [
    "summary",
    "conversationId",
    "conversationTag",
    "body",
  ]);
  if (unsupported.length > 0) {
    return {
      ok: false,
      error: unsupportedFieldsError(unsupported),
    };
  }

  const summary = summaryFromPayload(record);
  const conversationId = normalizeText(record.conversationId, 120);
  const conversationTag = normalizeText(record.conversationTag, 40);
  const body = normalizeText(record.body, 4000);

  if (!summary || !conversationId || !body) {
    return {
      ok: false,
      error: "This drafted reply payload is invalid.",
    };
  }

  if (!isUuid(conversationId)) {
    return {
      ok: false,
      error:
        "Drafted client replies require a UUID conversationId. Display tags like CONV-XXXXXX are for UI only and cannot be executed.",
    };
  }

  return {
    ok: true,
    value: {
      summary,
      conversationId,
      conversationTag,
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

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function getStartDate(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function getTodayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function getFutureDateKey(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function safeBusinessRows<T = Record<string, unknown>>(args: {
  table: string;
  businessId: string;
  select: string;
  limit?: number;
  orderBy?: string;
  ascending?: boolean;
}) {
  const supabase = createAdminClient() as any;
  let query = supabase
    .from(args.table)
    .select(args.select)
    .eq("business_id", args.businessId);

  if (args.orderBy) {
    query = query.order(args.orderBy, { ascending: Boolean(args.ascending) });
  }

  if (args.limit) {
    query = query.limit(args.limit);
  }

  const { data, error } = await query;
  if (error) {
    if (!isMissingTableError(error)) {
      console.error("[assistant] row lookup failed", {
        table: args.table,
        businessId: args.businessId,
        message: error.message,
        code: error.code,
      });
    }
    return [] as T[];
  }

  return (data || []) as T[];
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
  const today = getTodayDateKey();
  const soonDate = getFutureDateKey(14);
  const recentDate = getStartDate(30);
  const recentActivityDate = getStartDate(7);
  const effectivePlan = await resolveAccessPlanForBusiness({
    business: {
      id: business.id,
      owner_id: business.owner_id || null,
      plan: business.plan || null,
    },
    userId: business.owner_id || "assistant",
    email: null,
  });

  const [
    servicesCount,
    productsCount,
    propertiesCount,
    bookingsCount,
    reservationsCount,
    ordersCount,
    conversationCount,
    conversationSummaries,
    promoCodes,
    serviceBookings,
    rentalReservations,
    orders,
    businessProfile,
  ] = await Promise.all([
    safeBusinessCount("services", business.id),
    safeBusinessCount("products", business.id),
    safeBusinessCount("property", business.id),
    safeBusinessCount("bookings", business.id),
    safeBusinessCount("rental_reservations", business.id),
    safeBusinessCount("orders", business.id),
    safeBusinessCount("conversations", business.id),
    getAdminConversationSummaries({
      businessId: business.id,
    }).catch(() => []),
    safeBusinessRows<Database["public"]["Tables"]["discount_codes"]["Row"]>({
      table: "discount_codes",
      businessId: business.id,
      select:
        "id,code,active,usage_count,expires_at,starts_at,discount_type,discount_value",
      limit: 24,
      orderBy: "created_at",
    }),
    safeBusinessRows<
      Pick<
        Database["public"]["Tables"]["bookings"]["Row"],
        | "id"
        | "status"
        | "payment_status"
        | "date"
        | "created_at"
        | "amount_total"
        | "total_amount"
      >
    >({
      table: "bookings",
      businessId: business.id,
      select: "id,status,payment_status,date,created_at,amount_total,total_amount",
      limit: 80,
      orderBy: "created_at",
    }),
    safeBusinessRows<
      Pick<
        Database["public"]["Tables"]["rental_reservations"]["Row"],
        "id" | "status" | "payment_status" | "check_in_date" | "created_at" | "amount_total"
      >
    >({
      table: "rental_reservations",
      businessId: business.id,
      select: "id,status,payment_status,check_in_date,created_at,amount_total",
      limit: 80,
      orderBy: "created_at",
    }),
    safeBusinessRows<
      Pick<
        Database["public"]["Tables"]["orders"]["Row"],
        "id" | "status" | "payment_status" | "created_at" | "total_amount"
      >
    >({
      table: "orders",
      businessId: business.id,
      select: "id,status,payment_status,created_at,total_amount",
      limit: 80,
      orderBy: "created_at",
    }),
    (async () => {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from("businesses")
        .select("id,name,slug,description,business_type")
        .eq("id", business.id)
        .maybeSingle();
      return data as
        | Pick<
            Database["public"]["Tables"]["businesses"]["Row"],
            "id" | "name" | "slug" | "description" | "business_type"
          >
        | null;
    })(),
  ]);

  const unreadMessages = conversationSummaries.reduce(
    (sum, conversation) => sum + Number(conversation.business_unread_count || 0),
    0
  );
  const openConversations = conversationSummaries.filter(
    (conversation) => conversation.status === "open"
  ).length;
  const activePromoCodes = promoCodes.filter((code) => code.active !== false).length;
  const expiringPromoCodes = promoCodes.filter((code) => {
    if (!code.active || !code.expires_at) {
      return false;
    }

    return code.expires_at.slice(0, 10) >= today && code.expires_at.slice(0, 10) <= soonDate;
  });
  const upcomingServiceBookings = serviceBookings.filter((booking) => {
    const bookingDate = String(booking.date || "");
    const status = String(booking.status || "").toLowerCase();
    return bookingDate >= today && bookingDate <= soonDate && status !== "cancelled";
  }).length;
  const upcomingRentalReservations = rentalReservations.filter((reservation) => {
    const reservationDate = String(reservation.check_in_date || "");
    const status = String(reservation.status || "").toLowerCase();
    return reservationDate >= today && reservationDate <= soonDate && status !== "cancelled";
  }).length;
  const upcomingOrders = orders.filter((order) => {
    const createdDate = String(order.created_at || "").slice(0, 10);
    const status = String(order.status || order.payment_status || "").toLowerCase();
    return (
      createdDate >= recentActivityDate &&
      status !== "completed" &&
      status !== "fulfilled" &&
      status !== "cancelled" &&
      status !== "canceled"
    );
  }).length;
  const recentCustomerActivity =
    conversationSummaries.filter((conversation) => {
      const timestamp = String(conversation.last_message_at || "");
      return timestamp.slice(0, 10) >= recentActivityDate;
    }).length +
    serviceBookings.filter((booking) => String(booking.created_at || "").slice(0, 10) >= recentActivityDate)
      .length +
    rentalReservations.filter(
      (reservation) => String(reservation.created_at || "").slice(0, 10) >= recentActivityDate
    ).length +
    orders.filter((order) => String(order.created_at || "").slice(0, 10) >= recentActivityDate).length;
  const paidServiceRevenue = serviceBookings.reduce((sum, booking) => {
    const createdDate = String(booking.created_at || "").slice(0, 10);
    const isPaid =
      String(booking.payment_status || "").toLowerCase() === "paid" ||
      String(booking.status || "").toLowerCase() === "confirmed";
    if (!isPaid || createdDate < recentDate) {
      return sum;
    }
    return sum + Number(booking.amount_total ?? booking.total_amount ?? 0) / 100;
  }, 0);
  const paidRentalRevenue = rentalReservations.reduce((sum, reservation) => {
    const createdDate = String(reservation.created_at || "").slice(0, 10);
    const isPaid =
      String(reservation.payment_status || "").toLowerCase() === "paid" ||
      String(reservation.status || "").toLowerCase() === "confirmed";
    if (!isPaid || createdDate < recentDate) {
      return sum;
    }
    return sum + Number(reservation.amount_total || 0) / 100;
  }, 0);
  const paidOrderRevenue = orders.reduce((sum, order) => {
    const createdDate = String(order.created_at || "").slice(0, 10);
    const normalizedStatus = String(order.status || "").toLowerCase();
    const isPaid =
      String(order.payment_status || "").toLowerCase() === "paid" ||
      normalizedStatus === "completed" ||
      normalizedStatus === "fulfilled";
    if (!isPaid || createdDate < recentDate) {
      return sum;
    }
    return sum + Number(order.total_amount || 0);
  }, 0);
  const paidTransactionCount =
    serviceBookings.filter((booking) => {
      const createdDate = String(booking.created_at || "").slice(0, 10);
      return (
        createdDate >= recentDate &&
        (String(booking.payment_status || "").toLowerCase() === "paid" ||
          String(booking.status || "").toLowerCase() === "confirmed")
      );
    }).length +
    rentalReservations.filter((reservation) => {
      const createdDate = String(reservation.created_at || "").slice(0, 10);
      return (
        createdDate >= recentDate &&
        (String(reservation.payment_status || "").toLowerCase() === "paid" ||
          String(reservation.status || "").toLowerCase() === "confirmed")
      );
    }).length +
    orders.filter((order) => {
      const createdDate = String(order.created_at || "").slice(0, 10);
      const normalizedStatus = String(order.status || "").toLowerCase();
      return (
        createdDate >= recentDate &&
        (String(order.payment_status || "").toLowerCase() === "paid" ||
          normalizedStatus === "completed" ||
          normalizedStatus === "fulfilled")
      );
    }).length;
  const last30DaysGross = paidServiceRevenue + paidRentalRevenue + paidOrderRevenue;
  const profileCompletion = getBusinessProfileCompletion({
    name: businessProfile?.name || business.name,
    slug: businessProfile?.slug || null,
    description: businessProfile?.description || null,
    business_type: businessProfile?.business_type || business.business_type,
  });
  const recentActivitySummary = [
    unreadMessages > 0
      ? {
          id: "unread-messages",
          label: "Unread messages",
          detail: `${unreadMessages} customer messages are waiting for a response.`,
          href: "/admin/messages",
        }
      : null,
    upcomingServiceBookings + upcomingRentalReservations > 0
      ? {
          id: "upcoming-bookings",
          label: "Upcoming bookings",
          detail: `${upcomingServiceBookings + upcomingRentalReservations} appointments or reservations are coming up in the next 14 days.`,
          href: "/admin/bookings",
        }
      : null,
    upcomingOrders > 0
      ? {
          id: "order-queue",
          label: "Order queue",
          detail: `${upcomingOrders} recent orders still look open for fulfillment review.`,
          href: "/admin/orders",
        }
      : null,
    paidTransactionCount > 0
      ? {
          id: "recent-revenue",
          label: "Recent revenue",
          detail: `${formatCompactCurrency(last30DaysGross)} across ${paidTransactionCount} paid transactions in the last 30 days.`,
          href: "/admin/payments",
        }
      : null,
  ].filter(Boolean) as AssistantContextSummary["recentActivitySummary"];
  const insights = [
    unreadMessages > 0
      ? {
          id: "reply-backlog",
          title: "Unread messages need attention",
          detail: `${unreadMessages} unread customer messages are waiting in the inbox.`,
          href: "/admin/messages",
          tone: "warning" as const,
        }
      : null,
    upcomingServiceBookings + upcomingRentalReservations + upcomingOrders > 0
      ? {
          id: "upcoming-work",
          title: "Upcoming customer work is scheduled",
          detail: `${upcomingServiceBookings + upcomingRentalReservations + upcomingOrders} bookings, reservations, or orders are active in the near-term queue.`,
          href: isOrderBusiness ? "/admin/orders" : "/admin/bookings",
          tone: "default" as const,
        }
      : null,
    expiringPromoCodes.length > 0
      ? {
          id: "promo-expiring",
          title: "Promo codes are expiring soon",
          detail: `${expiringPromoCodes.length} active promo code${expiringPromoCodes.length === 1 ? "" : "s"} expire in the next 14 days.`,
          href: "/admin/promo-codes",
          tone: "warning" as const,
        }
      : null,
    !profileCompletion.canPublishProfile
      ? {
          id: "profile-completion",
          title: "Profile details are still incomplete",
          detail: profileCompletion.summary,
          href: "/admin/customize",
          tone: "warning" as const,
        }
      : null,
    recentCustomerActivity === 0
      ? {
          id: "slow-activity",
          title: "Customer activity looks slow",
          detail: "There has been no recent customer activity in the last 7 days. Review messaging, offers, and public profile visibility.",
          href: "/admin/dashboard",
          tone: "warning" as const,
        }
      : null,
    ((servicesCount || 0) + (productsCount || 0) + (propertiesCount || 0)) <= 1
      ? {
          id: "catalog-depth",
          title: "Offerings are still thin",
          detail: "Seravelle recommends adding more real offerings so the workspace feels complete to customers.",
          href: isRentalBusiness
            ? "/admin/rentals"
            : isOrderBusiness
              ? "/admin/products"
              : "/admin/services",
          tone: "default" as const,
        }
      : null,
    paidTransactionCount > 0
      ? {
          id: "recent-revenue-signal",
          title: "Revenue signal is active",
          detail: `${formatCompactCurrency(last30DaysGross)} has been processed in the last 30 days without exposing private payment details.`,
          href: "/admin/payments",
          tone: "success" as const,
        }
      : null,
  ].filter(Boolean) as AssistantContextSummary["insights"];
  const recommendedNextSteps = [
    unreadMessages > 0
      ? {
          id: "next-reply",
          label: "Reply to waiting customers",
          detail: "Use Seravelle to draft responses for the conversations that still need follow-up.",
          href: "/admin/messages",
        }
      : null,
    !profileCompletion.canPublishProfile
      ? {
          id: "next-profile",
          label: "Finish the public profile",
          detail: profileCompletion.summary,
          href: "/admin/customize",
        }
      : null,
    expiringPromoCodes.length > 0
      ? {
          id: "next-promo",
          label: "Refresh expiring promo codes",
          detail: "Retire or replace expiring offers so checkout campaigns stay current.",
          href: "/admin/promo-codes",
        }
      : null,
    recentCustomerActivity === 0
      ? {
          id: "next-visibility",
          label: "Improve visibility and demand",
          detail: "Refresh your offer mix, review analytics, and publish a sharper customer-facing message.",
          href: "/admin/analytics",
        }
      : null,
    ((servicesCount || 0) + (productsCount || 0) + (propertiesCount || 0)) <= 1
      ? {
          id: "next-offering",
          label: "Expand the offering mix",
          detail: "Add another service, product, menu item, or rental so customers have more choices.",
          href: isRentalBusiness
            ? "/admin/rentals"
            : isOrderBusiness
              ? "/admin/products"
              : "/admin/services",
        }
      : null,
  ].filter(Boolean) as AssistantContextSummary["recommendedNextSteps"];

  return {
    businessName: business.name || "Active business",
    businessType: business.business_type || "business",
    serviceCategory: business.service_category || null,
    plan: normalizeStoredPlan(business.plan),
    effectivePlan: normalizeStoredPlan(effectivePlan),
    published: Boolean(business.is_published),
    counts: {
      services: isOrderBusiness || isRentalBusiness ? null : servicesCount,
      products: isOrderBusiness ? productsCount : null,
      rentalsOrProperties: isRentalBusiness ? propertiesCount : null,
      bookingsOrReservations: isRentalBusiness ? reservationsCount : bookingsCount,
      orders: isOrderBusiness ? ordersCount : null,
      customerConversationThreads: conversationCount,
    },
    metrics: {
      activePromoCodes,
      unreadMessages,
      openConversations,
      upcomingItems:
        upcomingServiceBookings + upcomingRentalReservations + upcomingOrders,
      recentCustomerActivity,
    },
    revenue: {
      last30DaysGross: paidTransactionCount > 0 ? last30DaysGross : null,
      paidTransactions: paidTransactionCount,
      windowLabel: "Last 30 days",
    },
    recentActivitySummary,
    insights,
    recommendedNextSteps,
  };
}

function sortAssistantConversations(
  left: AssistantConversationRecord,
  right: AssistantConversationRecord
) {
  const statusOrder: Record<AssistantConversationStatus, number> = {
    active: 0,
    archived: 1,
    cleared: 2,
  };
  const statusDelta = statusOrder[left.status] - statusOrder[right.status];
  if (statusDelta !== 0) {
    return statusDelta;
  }

  return (
    getTimestamp(right.last_message_at || right.updated_at) -
    getTimestamp(left.last_message_at || left.updated_at)
  );
}

async function loadAssistantConversationPreviewMap(
  conversationIds: string[]
) {
  const previews = new Map<string, { preview: string; createdAt: string }>();
  if (conversationIds.length === 0) {
    return previews;
  }

  const supabase = createAdminClient() as any;
  const [messageResult, actionResult] = await Promise.all([
    supabase
      .from("assistant_messages")
      .select("assistant_conversation_id,content,created_at")
      .in("assistant_conversation_id", conversationIds)
      .order("created_at", { ascending: false })
      .limit(Math.max(40, conversationIds.length * 8)),
    supabase
      .from("assistant_actions")
      .select("assistant_conversation_id,payload,created_at")
      .in("assistant_conversation_id", conversationIds)
      .order("created_at", { ascending: false })
      .limit(Math.max(24, conversationIds.length * 4)),
  ]);

  if (!messageResult.error) {
    for (const row of messageResult.data || []) {
      const conversationId = String(row.assistant_conversation_id || "").trim();
      if (!conversationId || previews.has(conversationId)) {
        continue;
      }

      const preview = normalizeText(row.content, 240);
      if (!preview) {
        continue;
      }

      previews.set(conversationId, {
        preview: truncateText(preview, 120),
        createdAt: String(row.created_at || ""),
      });
    }
  }

  if (!actionResult.error) {
    for (const row of actionResult.data || []) {
      const conversationId = String(row.assistant_conversation_id || "").trim();
      if (!conversationId || previews.has(conversationId)) {
        continue;
      }

      const payload =
        row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
          ? (row.payload as JsonObject)
          : {};
      const summary = summaryFromPayload(payload);
      if (!summary) {
        continue;
      }

      previews.set(conversationId, {
        preview: truncateText(summary, 120),
        createdAt: String(row.created_at || ""),
      });
    }
  }

  return previews;
}

export async function createFreshAssistantConversation(args: {
  businessId: string;
  userId: string;
  title?: string | null;
  status?: AssistantConversationStatus;
}) {
  const supabase = createAdminClient();
  const timestamp = nowIso();
  const { data, error } = await supabase
    .from("assistant_conversations")
    .insert({
      business_id: args.businessId,
      user_id: args.userId,
      title: normalizeConversationTitle(args.title),
      status: args.status || "active",
      updated_at: timestamp,
      last_message_at: timestamp,
    })
    .select("id,business_id,user_id,title,status,created_at,updated_at,last_message_at")
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false as const,
      error:
        isMissingTableError(error)
          ? ASSISTANT_CONVERSATION_SETUP_ERROR
          : error?.message || "Seravelle conversation could not be created.",
    };
  }

  return {
    ok: true as const,
    conversation: normalizeConversationRecord(
      data as AssistantConversationRow,
      null
    ),
  };
}

async function syncAssistantConversationDetails(args: {
  conversationId: string;
  occurredAt?: string | null;
  suggestedTitle?: string | null;
}) {
  const supabase = createAdminClient();
  const updates: Record<string, unknown> = {
    updated_at: args.occurredAt || nowIso(),
  };

  if (args.occurredAt) {
    updates.last_message_at = args.occurredAt;
  }

  const existing = await supabase
    .from("assistant_conversations")
    .select("id,title")
    .eq("id", args.conversationId)
    .maybeSingle();

  if (!existing.error && existing.data && !existing.data.title && args.suggestedTitle) {
    updates.title = buildConversationTitleFromText(args.suggestedTitle);
  }

  await supabase
    .from("assistant_conversations")
    .update(updates)
    .eq("id", args.conversationId);
}

function buildAssistantMemorySummary(args: {
  business: Pick<AssistantBusinessScope, "name" | "business_type" | "service_category">;
  title: string | null;
  messages: Array<Pick<AssistantMessageRow, "role" | "content" | "created_at">>;
  actions: AssistantActionRecord[];
}) {
  const preferenceSignals = Array.from(
    new Set(
      args.messages
        .filter((message) => message.role === "user")
        .map((message) => String(message.content || "").trim())
        .filter((content) => {
          const lowered = content.toLowerCase();
          return (
            lowered.includes("prefer ") ||
            lowered.includes("please keep") ||
            lowered.includes("our goal") ||
            lowered.includes("we want") ||
            lowered.includes("remember ") ||
            lowered.includes("customers usually ask") ||
            lowered.includes("common question")
          );
        })
        .map((content) => truncateText(content, 180))
    )
  ).slice(0, 4);
  const userHighlights = args.messages
    .filter((message) => message.role === "user")
    .slice(-3)
    .map((message) => truncateText(String(message.content || "").trim(), 160))
    .filter(Boolean);
  const assistantHighlights = args.messages
    .filter((message) => message.role === "assistant")
    .slice(-2)
    .map((message) => truncateText(String(message.content || "").trim(), 180))
    .filter(Boolean);
  const actionHighlights = args.actions
    .slice(-3)
    .map((action) => {
      const summary = summaryFromPayload(action.payload as JsonObject);
      return summary
        ? `${formatActionTypeForMemory(action.action_type)}: ${summary}`
        : null;
    })
    .filter(Boolean);
  const approvedActionPatterns = args.actions
    .filter((action) => action.status === "approved" || action.status === "executed")
    .slice(-3)
    .map((action) => {
      const summary = summaryFromPayload(action.payload as JsonObject);
      return summary
        ? `${formatActionTypeForMemory(action.action_type)} approved: ${summary}`
        : null;
    })
    .filter(Boolean);
  const businessProfileHighlights = [
    args.business.name ? `Business: ${args.business.name}` : null,
    args.business.business_type ? `Type: ${args.business.business_type}` : null,
    args.business.service_category
      ? `Category: ${args.business.service_category}`
      : null,
  ].filter(Boolean) as string[];

  const summaryLines = [
    businessProfileHighlights[0] || null,
    businessProfileHighlights[1] || null,
    businessProfileHighlights[2] || null,
    args.title ? `Conversation: ${args.title}` : null,
    userHighlights[0] ? `Primary request: ${userHighlights[0]}` : null,
    preferenceSignals[0]
      ? `Owner preference: ${preferenceSignals[0]}`
      : userHighlights[1]
        ? `Owner preference: ${userHighlights[1]}`
        : null,
    preferenceSignals[1] ? `Business goal: ${preferenceSignals[1]}` : null,
    assistantHighlights[0] ? `Seravelle guidance: ${assistantHighlights[0]}` : null,
    approvedActionPatterns.length > 0
      ? `Approved patterns: ${approvedActionPatterns.join("; ")}`
      : null,
    actionHighlights.length > 0 ? `Drafts: ${actionHighlights.join("; ")}` : null,
  ].filter(Boolean) as string[];

  const summary = truncateText(summaryLines.join(" "), 1200);
  const topics = extractKeywordTokens(
    [
      ...businessProfileHighlights,
      args.title || "",
      ...userHighlights,
      ...preferenceSignals,
      ...assistantHighlights,
      ...approvedActionPatterns,
      ...actionHighlights,
    ].join(" "),
    10
  );

  return {
    summary,
    topics,
  };
}

function formatActionTypeForMemory(value: string) {
  return value
    .replace(/^draft_/, "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function upsertAssistantMemorySummary(args: {
  businessId: string;
  userId: string;
  conversationId: string;
}) {
  const supabase = createAdminClient();
  const [conversationResult, messageResult, actionResult] = await Promise.all([
    supabase
      .from("assistant_conversations")
      .select("id,business_id,title,status,updated_at,last_message_at")
      .eq("id", args.conversationId)
      .maybeSingle(),
    supabase
      .from("assistant_messages")
      .select("role,content,created_at")
      .eq("assistant_conversation_id", args.conversationId)
      .order("created_at", { ascending: true })
      .limit(24),
    supabase
      .from("assistant_actions")
      .select("id,business_id,user_id,assistant_conversation_id,action_type,status,payload,result,created_at,updated_at")
      .eq("assistant_conversation_id", args.conversationId)
      .order("created_at", { ascending: true })
      .limit(12),
  ]);

  if (
    conversationResult.error ||
    !conversationResult.data ||
    messageResult.error ||
    actionResult.error
  ) {
    return;
  }

  const { data: businessData } = await supabase
    .from("businesses")
    .select("id,name,business_type,service_category")
    .eq("id", args.businessId)
    .maybeSingle();

  const summaryPayload = buildAssistantMemorySummary({
    business: {
      name: businessData?.name ? String(businessData.name) : null,
      business_type: businessData?.business_type ? String(businessData.business_type) : null,
      service_category: businessData?.service_category
        ? String(businessData.service_category)
        : null,
    },
    title: conversationResult.data.title,
    messages: ((messageResult.data || []) as Array<
      Pick<AssistantMessageRow, "role" | "content" | "created_at">
    >),
    actions: ((actionResult.data || []) as AssistantActionRow[]).map(normalizeActionRecord),
  });

  if (!summaryPayload.summary) {
    return;
  }

  await supabase.from("assistant_memory_summaries").upsert(
    {
      business_id: args.businessId,
      user_id: args.userId,
      assistant_conversation_id: args.conversationId,
      summary: summaryPayload.summary,
      topics: summaryPayload.topics,
      updated_at: nowIso(),
    },
    {
      onConflict: "assistant_conversation_id",
    }
  );
}

async function ensureLegacyAssistantConversationData(args: {
  businessId: string;
  userId: string;
}) {
  const supabase = createAdminClient() as any;
  const [legacyMessagesResult, legacyActionsResult, conversationsResult] = await Promise.all([
    supabase
      .from("assistant_messages")
      .select("id,role,content,created_at")
      .eq("business_id", args.businessId)
      .eq("user_id", args.userId)
      .is("assistant_conversation_id", null)
      .order("created_at", { ascending: true })
      .limit(80),
    supabase
      .from("assistant_actions")
      .select("id")
      .eq("business_id", args.businessId)
      .eq("user_id", args.userId)
      .is("assistant_conversation_id", null)
      .limit(40),
    supabase
      .from("assistant_conversations")
      .select("id,title,status,created_at,updated_at,last_message_at")
      .eq("business_id", args.businessId)
      .eq("user_id", args.userId)
      .order("created_at", { ascending: true }),
  ]);

  if (
    legacyMessagesResult.error ||
    legacyActionsResult.error ||
    conversationsResult.error
  ) {
    if (
      isMissingTableError(legacyMessagesResult.error) ||
      isMissingTableError(legacyActionsResult.error) ||
      isMissingTableError(conversationsResult.error)
    ) {
      return ASSISTANT_CONVERSATION_SETUP_ERROR;
    }

    return null;
  }

  const legacyMessages = legacyMessagesResult.data || [];
  const legacyActions = legacyActionsResult.data || [];
  if (legacyMessages.length === 0 && legacyActions.length === 0) {
    return null;
  }

  const existingConversations = (conversationsResult.data || []) as AssistantConversationRow[];
  const firstUserMessage = legacyMessages.find((message: AssistantMessageRow) => message.role === "user");
  const createdConversation = await createFreshAssistantConversation({
    businessId: args.businessId,
    userId: args.userId,
    title: firstUserMessage?.content || "Earlier Seravelle discussion",
    status: existingConversations.length === 0 ? "active" : "archived",
  });

  if (!createdConversation.ok) {
    return createdConversation.error;
  }

  const conversationId = createdConversation.conversation.id;

  await Promise.all([
    legacyMessages.length > 0
      ? supabase
          .from("assistant_messages")
          .update({ assistant_conversation_id: conversationId })
          .eq("business_id", args.businessId)
          .eq("user_id", args.userId)
          .is("assistant_conversation_id", null)
      : Promise.resolve(),
    legacyActions.length > 0
      ? supabase
          .from("assistant_actions")
          .update({ assistant_conversation_id: conversationId })
          .eq("business_id", args.businessId)
          .eq("user_id", args.userId)
          .is("assistant_conversation_id", null)
      : Promise.resolve(),
  ]);

  if (existingConversations.length > 0) {
    await upsertAssistantMemorySummary({
      businessId: args.businessId,
      userId: args.userId,
      conversationId,
    });
  }

  return null;
}

export async function loadAssistantConversations(args: {
  businessId: string;
  userId: string;
  requestedConversationId?: string | null;
  limit?: number;
}): Promise<AssistantConversationSelection> {
  const legacyError = await ensureLegacyAssistantConversationData({
    businessId: args.businessId,
    userId: args.userId,
  });

  if (legacyError) {
    return {
      selectedConversation: null,
      conversations: [],
      storageError: legacyError,
    };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("assistant_conversations")
    .select("id,title,status,created_at,updated_at,last_message_at")
    .eq("business_id", args.businessId)
    .eq("user_id", args.userId)
    .order("updated_at", { ascending: false })
    .limit(args.limit || 24);

  if (error) {
    return {
      selectedConversation: null,
      conversations: [],
      storageError:
        isMissingTableError(error)
          ? ASSISTANT_CONVERSATION_SETUP_ERROR
          : error.message || "Seravelle conversations could not be loaded.",
    };
  }

  let rows = (data || []) as AssistantConversationRow[];
  if (rows.length === 0) {
    const created = await createFreshAssistantConversation({
      businessId: args.businessId,
      userId: args.userId,
      status: "active",
    });

    if (!created.ok) {
      return {
        selectedConversation: null,
        conversations: [],
        storageError: created.error,
      };
    }

    rows = [
      {
        id: created.conversation.id,
        business_id: args.businessId,
        user_id: args.userId,
        title: created.conversation.title,
        status: created.conversation.status,
        created_at: created.conversation.created_at,
        updated_at: created.conversation.updated_at,
        last_message_at: created.conversation.last_message_at,
      } satisfies AssistantConversationRow,
    ];
  }

  const previewMap = await loadAssistantConversationPreviewMap(rows.map((row) => row.id));
  const conversations = rows
    .map((row) =>
      normalizeConversationRecord(
        row,
        previewMap.get(row.id)?.preview || null
      )
    )
    .sort(sortAssistantConversations);

  const selectedConversation =
    conversations.find((conversation) => conversation.id === args.requestedConversationId) ||
    conversations.find((conversation) => conversation.status === "active") ||
    conversations[0] ||
    null;

  return {
    selectedConversation,
    conversations,
    storageError: null,
  };
}

export async function archiveAssistantConversationAndStartFresh(args: {
  businessId: string;
  userId: string;
  currentConversationId: string;
  archiveStatus: "archived" | "cleared";
}) {
  const supabase = createAdminClient();
  const currentResult = await supabase
    .from("assistant_conversations")
    .select("id,business_id,user_id,title,status,created_at,updated_at,last_message_at")
    .eq("id", args.currentConversationId)
    .eq("business_id", args.businessId)
    .eq("user_id", args.userId)
    .maybeSingle();

  if (currentResult.error || !currentResult.data) {
    return {
      ok: false as const,
      error:
        isMissingTableError(currentResult.error)
          ? ASSISTANT_CONVERSATION_SETUP_ERROR
          : currentResult.error?.message || "Seravelle conversation could not be updated.",
    };
  }

  await upsertAssistantMemorySummary({
    businessId: args.businessId,
    userId: args.userId,
    conversationId: args.currentConversationId,
  });

  const archivedAt = nowIso();
  const { error: archiveError } = await supabase
    .from("assistant_conversations")
    .update({
      status: args.archiveStatus,
      updated_at: archivedAt,
    })
    .eq("id", args.currentConversationId);

  if (archiveError) {
    return {
      ok: false as const,
      error:
        isMissingTableError(archiveError)
          ? ASSISTANT_CONVERSATION_SETUP_ERROR
          : archiveError.message || "Seravelle conversation could not be archived.",
    };
  }

  const created = await createFreshAssistantConversation({
    businessId: args.businessId,
    userId: args.userId,
    status: "active",
  });

  if (!created.ok) {
    return created;
  }

  return {
    ok: true as const,
    archivedConversationId: args.currentConversationId,
    conversation: created.conversation,
  };
}

export async function loadRelevantAssistantMemories(args: {
  businessId: string;
  userId: string;
  currentConversationId: string | null;
  message: string;
  limit?: number;
}) {
  if (!shouldRetrieveAssistantMemory(args.message)) {
    return [] as AssistantMemoryBlock[];
  }

  const supabase = createAdminClient();
  const { data: conversations, error: conversationsError } = await supabase
    .from("assistant_conversations")
    .select("id,title,status,updated_at,last_message_at")
    .eq("business_id", args.businessId)
    .eq("user_id", args.userId)
    .in("status", ["active", "archived", "cleared"])
    .order("updated_at", { ascending: false })
    .limit(24);

  if (conversationsError || !conversations?.length) {
    return [] as AssistantMemoryBlock[];
  }

  const archivedConversations = (conversations as AssistantConversationRow[]).filter(
    (conversation) => conversation.id !== args.currentConversationId
  );
  if (archivedConversations.length === 0) {
    return [] as AssistantMemoryBlock[];
  }

  const conversationMap = new Map(
    archivedConversations.map((conversation) => [conversation.id, conversation])
  );
  const tokens = extractKeywordTokens(args.message, 6);
  const conversationIds = archivedConversations.map((conversation) => conversation.id);

  const { data: summaries, error: summariesError } = await supabase
    .from("assistant_memory_summaries")
    .select("id,business_id,user_id,assistant_conversation_id,summary,topics,created_at,updated_at")
    .eq("business_id", args.businessId)
    .eq("user_id", args.userId)
    .in("assistant_conversation_id", conversationIds)
    .order("updated_at", { ascending: false })
    .limit(48);

  const rankedSummaries = ((summariesError ? [] : summaries) || [])
    .map((row) => {
      const record = row as AssistantMemorySummaryRow;
      const haystack = `${record.summary} ${(record.topics || []).join(" ")}`.toLowerCase();
      const score = tokens.reduce(
        (total, token) => total + (haystack.includes(token) ? 3 : 0),
        0
      );

      return {
        record,
        score,
      };
    })
    .filter((entry) => entry.score > 0 || tokens.length === 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        getTimestamp(right.record.updated_at) - getTimestamp(left.record.updated_at)
    )
    .slice(0, args.limit || 3)
    .map(({ record }) => {
      const conversation = conversationMap.get(record.assistant_conversation_id);
      return {
        conversationId: record.assistant_conversation_id,
        title: conversation?.title || "Earlier Seravelle discussion",
        status: (conversation?.status || "archived") as AssistantConversationStatus,
        summary: record.summary,
        topics: record.topics || [],
        updatedAt: record.updated_at,
      } satisfies AssistantMemoryBlock;
    });

  if (rankedSummaries.length > 0) {
    return rankedSummaries;
  }

  const { data: messageMatches, error: messageMatchesError } = await supabase
    .from("assistant_messages")
    .select("assistant_conversation_id,role,content,created_at")
    .eq("business_id", args.businessId)
    .eq("user_id", args.userId)
    .in("assistant_conversation_id", conversationIds)
    .order("created_at", { ascending: false })
    .limit(80);

  if (messageMatchesError) {
    return [] as AssistantMemoryBlock[];
  }

  const snippets = new Map<string, AssistantMemoryBlock>();
  for (const row of messageMatches || []) {
    const conversationId = String(row.assistant_conversation_id || "").trim();
    if (!conversationId || snippets.has(conversationId)) {
      continue;
    }

    const content = String(row.content || "").trim();
    if (!content) {
      continue;
    }

    const haystack = content.toLowerCase();
    if (tokens.length > 0 && !tokens.some((token) => haystack.includes(token))) {
      continue;
    }

    const conversation = conversationMap.get(conversationId);
    snippets.set(conversationId, {
      conversationId,
      title: conversation?.title || "Earlier Seravelle discussion",
      status: (conversation?.status || "archived") as AssistantConversationStatus,
      summary: truncateText(content, 320),
      topics: tokens,
      updatedAt: String(row.created_at || conversation?.updated_at || ""),
    });
  }

  return Array.from(snippets.values()).slice(0, args.limit || 3);
}

export async function loadAssistantMemorySummaries(args: {
  businessId: string;
  userId: string;
  limit?: number;
}): Promise<AssistantMemorySummaryLoadResult> {
  const supabase = createAdminClient();
  const [memoryResult, conversationResult] = await Promise.all([
    supabase
      .from("assistant_memory_summaries")
      .select("id,business_id,user_id,assistant_conversation_id,summary,topics,created_at,updated_at")
      .eq("business_id", args.businessId)
      .eq("user_id", args.userId)
      .order("updated_at", { ascending: false })
      .limit(args.limit || 12),
    supabase
      .from("assistant_conversations")
      .select("id,title,status")
      .eq("business_id", args.businessId)
      .eq("user_id", args.userId),
  ]);

  if (memoryResult.error) {
    return {
      memories: [],
      storageError:
        isMissingTableError(memoryResult.error)
          ? ASSISTANT_CONVERSATION_SETUP_ERROR
          : memoryResult.error.message || "Seravelle memories could not be loaded.",
    };
  }

  const conversationMap = new Map(
    ((conversationResult.data || []) as AssistantConversationRow[]).map((conversation) => [
      conversation.id,
      conversation,
    ])
  );

  const memories = ((memoryResult.data || []) as AssistantMemorySummaryRow[]).map((row) => {
    const conversation = conversationMap.get(row.assistant_conversation_id);
    return {
      id: row.id,
      conversationId: row.assistant_conversation_id,
      conversationTitle: conversation?.title || "Earlier Seravelle discussion",
      conversationStatus: (conversation?.status || "archived") as AssistantConversationStatus,
      summary: row.summary,
      topics: row.topics || [],
      updatedAt: row.updated_at,
    } satisfies AssistantMemorySummaryRecord;
  });

  return {
    memories,
    storageError: null,
  };
}

export async function deleteAssistantMemorySummary(args: {
  id: string;
  businessId: string;
  userId: string;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("assistant_memory_summaries")
    .delete()
    .eq("id", args.id)
    .eq("business_id", args.businessId)
    .eq("user_id", args.userId)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      error:
        isMissingTableError(error)
          ? ASSISTANT_CONVERSATION_SETUP_ERROR
          : error.message || "Seravelle memory could not be removed.",
    };
  }

  if (!data?.id) {
    return {
      ok: false as const,
      error: "Seravelle memory not found.",
    };
  }

  return {
    ok: true as const,
  };
}

export async function loadAssistantMessages(args: {
  businessId: string;
  userId: string;
  assistantConversationId: string;
  limit?: number;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("assistant_messages")
    .select("id,assistant_conversation_id,role,content,created_at")
    .eq("business_id", args.businessId)
    .eq("user_id", args.userId)
    .eq("assistant_conversation_id", args.assistantConversationId)
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
  assistantConversationId: string;
  messages: Array<Pick<AssistantMessageRow, "role" | "content">>;
}) {
  const supabase = createAdminClient();
  const rows = args.messages.map((message) => ({
    business_id: args.businessId,
    user_id: args.userId,
    assistant_conversation_id: args.assistantConversationId,
    role: message.role,
    content: message.content,
  }));

  const { data, error } = await supabase
    .from("assistant_messages")
    .insert(rows)
    .select("id,assistant_conversation_id,role,content,created_at")
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

  const latestCreatedAt = (data || []).reduce<string | null>((latest, row) => {
    const createdAt = String((row as AssistantMessageRow).created_at || "");
    if (!createdAt) {
      return latest;
    }
    return !latest || getTimestamp(createdAt) > getTimestamp(latest) ? createdAt : latest;
  }, null);
  const firstUserMessage = args.messages.find((message) => message.role === "user");
  await syncAssistantConversationDetails({
    conversationId: args.assistantConversationId,
    occurredAt: latestCreatedAt,
    suggestedTitle: firstUserMessage?.content || null,
  });
  await upsertAssistantMemorySummary({
    businessId: args.businessId,
    userId: args.userId,
    conversationId: args.assistantConversationId,
  });

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
  assistantConversationId: string;
  limit?: number;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("assistant_actions")
    .select("id,business_id,user_id,assistant_conversation_id,action_type,status,payload,result,created_at,updated_at")
    .eq("business_id", args.businessId)
    .eq("user_id", args.userId)
    .eq("assistant_conversation_id", args.assistantConversationId)
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
  assistantConversationId: string;
  action: AssistantActionDraft;
}) {
  const supabase = createAdminClient();
  let payload: AssistantActionPayload = args.action.payload;

  if (args.action.type === "draft_client_reply") {
    const parsedReply = parseClientReplyPayload(args.action.payload);
    if (!parsedReply.ok) {
      return {
        ok: false as const,
        error: parsedReply.error,
      };
    }

    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select("id,business_id")
      .eq("id", parsedReply.value.conversationId)
      .eq("business_id", args.businessId)
      .maybeSingle();

    if (conversationError) {
      return {
        ok: false as const,
        error:
          conversationError.message ||
          "The drafted client reply conversation could not be verified.",
      };
    }

    if (!conversation?.id) {
      return {
        ok: false as const,
        error:
          "Seravelle drafted reply must target a valid conversation UUID for this business.",
      };
    }

    payload = {
      ...parsedReply.value,
      conversationId: String(conversation.id),
      conversationTag: formatConversationTag(String(conversation.id)),
    };
  }

  const row = {
    business_id: args.businessId,
    user_id: args.userId,
    assistant_conversation_id: args.assistantConversationId,
    action_type: args.action.type,
    status: "draft",
    payload,
    result: {},
  };

  const { data, error } = await supabase
    .from("assistant_actions")
    .insert(row)
    .select("id,business_id,user_id,assistant_conversation_id,action_type,status,payload,result,created_at,updated_at")
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
    action: (() => {
      const normalized = normalizeActionRecord(data as AssistantActionRow);
      void upsertAssistantMemorySummary({
        businessId: normalized.business_id,
        userId: normalized.user_id,
        conversationId: normalized.assistant_conversation_id || args.assistantConversationId,
      });
      return normalized;
    })(),
  };
}

export async function getAssistantActionById(id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("assistant_actions")
    .select("id,business_id,user_id,assistant_conversation_id,action_type,status,payload,result,created_at,updated_at")
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
    .select("id,business_id,user_id,assistant_conversation_id,action_type,status,payload,result,created_at,updated_at")
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false as const,
      error: error?.message || "Assistant action could not be updated.",
    };
  }

  const normalized = normalizeActionRecord(data as AssistantActionRow);
  if (normalized.assistant_conversation_id) {
    await upsertAssistantMemorySummary({
      businessId: normalized.business_id,
      userId: normalized.user_id,
      conversationId: normalized.assistant_conversation_id,
    });
  }

  return {
    ok: true as const,
    action: normalized,
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

  const supabase = createAdminClient();
  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id,business_id,client_user_id")
    .eq("id", payload.conversationId)
    .eq("business_id", args.business.id)
    .maybeSingle();

  if (conversationError) {
    throw new Error(
      conversationError.message || "The drafted client reply conversation could not be loaded."
    );
  }

  if (!conversation?.id) {
    throw new Error("You do not have permission to send that drafted client reply.");
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: String(conversation.id),
      sender_user_id: args.userId,
      recipient_user_id: conversation.client_user_id ? String(conversation.client_user_id) : null,
      business_id: String(conversation.business_id),
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
    conversationId: String(conversation.id),
    senderType: "business",
    body: payload.body,
  });

  return {
    messageId: String(data.id),
    conversationId: String(conversation.id),
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
