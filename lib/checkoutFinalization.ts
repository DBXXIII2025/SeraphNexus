import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { updateCheckoutIntentSafely } from "@/lib/checkoutIntents";
import {
  readAppliedDiscount,
  serializeAppliedDiscount,
} from "@/lib/discountCodes";
import { upsertConversationForBooking } from "@/lib/messages";
import { createTransactionNotification } from "@/lib/notifications";
import { sendTransactionConfirmationEmail } from "@/lib/transactionEmails";

type JsonRecord = Record<string, unknown>;
type FinalizationSource = "order-status" | "stripe/webhook" | "booking-status";
type FlowType =
  | "service_booking"
  | "rental_reservation"
  | "food_order"
  | "store_order";
type SourceTable = "orders" | "bookings" | "rental_reservations";
type RecordAction = "created" | "updated" | "none";

type NormalizedOrderItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  source: string | null;
};

type NormalizedCheckoutIntent = {
  raw: JsonRecord;
  id: string;
  businessId: string | null;
  businessType: string | null;
  kind: "order" | "booking" | null;
  status: string | null;
  customerName: string | null;
  customerEmail: string | null;
  phone: string | null;
  fulfillmentType: string | null;
  address: JsonRecord;
  items: NormalizedOrderItem[];
  metadata: JsonRecord;
  totalCents: number;
  platformFeeCents: number;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  flowType: FlowType | null;
  sourceTable: SourceTable | null;
};

type ReconciliationDebug = {
  step: string;
  message: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
};

type FinalizationLogContext = {
  source: FinalizationSource;
  sessionId: string;
  paymentIntentId: string | null;
  checkoutIntentId: string | null;
  flowType: FlowType | null;
  businessType: string | null;
  sourceTable: SourceTable | null;
};

type FinalizeWriteResult = {
  sourceTable: SourceTable;
  recordId: string;
  recordAction: RecordAction;
  reusedOperationalRecord: boolean;
  duplicateRetryHandled: boolean;
  confirmationEmailEligible: boolean;
};

type OrderRow = {
  id?: string | null;
  status?: string | null;
  payment_status?: string | null;
};

type OrderItemRow = {
  id?: string | null;
};

type ReservationRow = {
  id?: string | null;
  nights?: number | null;
  status?: string | null;
  payment_status?: string | null;
};

type BookingRow = {
  id?: string | null;
  status?: string | null;
  payment_status?: string | null;
  stripe_session_id?: string | null;
  payment_intent_id?: string | null;
  guest_email?: string | null;
  phone?: string | null;
};

type MaybeSingleResponse<T> = {
  data: T | null;
  error: { message: string } | null;
};

type ManyResponse<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export type FinalizationResult = {
  paid: boolean;
  status: string;
  checkoutIntentId: string | null;
  orderId: string | null;
  bookingId: string | null;
  paymentStatus: string | null;
  orderStatus: string | null;
  updatedIntent: boolean;
  reusedOperationalRecord: boolean;
  duplicateRetryHandled: boolean;
  flowType: FlowType | null;
  businessType: string | null;
  sourceTable: SourceTable | null;
  recordId: string | null;
  recordAction: RecordAction;
};

export class ReconciliationError extends Error {
  step: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;

  constructor(debug: ReconciliationDebug) {
    super(debug.message);
    this.name = "ReconciliationError";
    this.step = debug.step;
    this.code = debug.code ?? null;
    this.details = debug.details ?? null;
    this.hint = debug.hint ?? null;
  }
}

const supabaseAdmin = createAdminClient();

function buildSyntheticIntentId(session: Stripe.Checkout.Session) {
  return `session:${session.id}`;
}

function centsToDollars(value: number | null | undefined) {
  return Number(value || 0) / 100;
}

function toBookingPlatformFeeValue(value: number | null | undefined) {
  return Math.max(0, Math.round(centsToDollars(value)));
}

function isMissingSchemaError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("relation") ||
    normalized.includes("does not exist") ||
    normalized.includes("column") ||
    normalized.includes("schema")
  );
}

function extractMissingColumnName(message: string) {
  const patterns = [
    /column ["']([^"']+)["']/i,
    /Could not find the ['"]([^'"]+)['"] column/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function isRetryableWriteConflict(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("duplicate key") ||
    normalized.includes("unique constraint") ||
    normalized.includes("already exists") ||
    normalized.includes("bookings_no_overlap") ||
    normalized.includes("conflict") ||
    normalized.includes("exclude constraint")
  );
}

function asRecord(value: unknown): JsonRecord {
  if (!value) {
    return {};
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as JsonRecord)
        : {};
    } catch {
      return {};
    }
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as JsonRecord;
  }

  return {};
}

function asArray(value: unknown): unknown[] {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return Array.isArray(value) ? value : [];
}

function asString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asNumber(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function formatAddress(address: JsonRecord) {
  const parts = [
    asString(address.line1),
    asString(address.line2),
    asString(address.city),
    asString(address.state),
    asString(address.postalCode),
  ].filter((part): part is string => Boolean(part));

  return parts.join(", ");
}

function buildBookingTime(date: string | null, startTime: string | null) {
  if (!date) {
    return null;
  }

  const normalizedTime = startTime || "00:00";
  return `${date}T${normalizedTime}:00`;
}

function hasAddress(address: JsonRecord) {
  return Boolean(formatAddress(address));
}

function hasNotes(metadata: JsonRecord) {
  return Boolean(asString(metadata.notes));
}

function getSafeMetadataObject(metadata: JsonRecord) {
  return Object.entries(metadata).reduce<JsonRecord>((safe, [key, value]) => {
    if (value !== undefined) {
      safe[key] = value;
    }
    return safe;
  }, {});
}

function getSessionMetadata(session: Stripe.Checkout.Session) {
  return getSafeMetadataObject(asRecord(session.metadata));
}

function isPaidSession(session: Stripe.Checkout.Session) {
  return session.payment_status === "paid" || session.status === "complete";
}

function getErrorDebug(step: string, error: unknown): ReconciliationDebug {
  const record = asRecord(error);
  return {
    step,
    message:
      (error instanceof Error ? error.message : asString(record.message)) ||
      "Unknown reconciliation error",
    code: asString(record.code),
    details: asString(record.details),
    hint: asString(record.hint),
  };
}

function logWriteError(
  step: string,
  payload: Record<string, unknown>,
  error: unknown,
  context: FinalizationLogContext
) {
  const debug = getErrorDebug(step, error);
  console.error("[checkout/finalize]", {
    stage: step,
    finalSuccess: false,
    ...context,
    payloadKeys: Object.keys(payload),
    message: debug.message,
    code: debug.code,
    details: debug.details,
    hint: debug.hint,
  });
}

function logFinalization(
  stage: string,
  context: FinalizationLogContext,
  extra?: Record<string, unknown>
) {
  console.log("[checkout/finalize]", {
    stage,
    ...context,
    ...(extra || {}),
  });
}

function normalizeOrderItems(value: unknown): NormalizedOrderItem[] {
  return asArray(value)
    .map((item) => {
      const record = asRecord(item);
      const id =
        asString(record.id) ||
        asString(record.item_id) ||
        asString(record.product_id) ||
        asString(record.menu_item_id) ||
        "";
      const name = asString(record.name) || asString(record.title) || "Item";
      const quantity = asNumber(record.quantity ?? record.qty ?? 0);
      const price = asNumber(record.price ?? record.unit_price ?? record.amount ?? 0);

      if (!id || quantity <= 0 || price <= 0) {
        return null;
      }

      return {
        id,
        name,
        price,
        quantity,
        source: asString(record.source),
      };
    })
    .filter((item): item is NormalizedOrderItem => Boolean(item));
}

function inferFlowType(input: {
  kind: "order" | "booking" | null;
  metadata: JsonRecord;
  businessType: string | null;
}): FlowType | null {
  const explicitFlow = asString(input.metadata.flow_type);
  if (
    explicitFlow === "service_booking" ||
    explicitFlow === "rental_reservation" ||
    explicitFlow === "food_order" ||
    explicitFlow === "store_order"
  ) {
    return explicitFlow;
  }

  if (
    asString(input.metadata.reservation_type) === "rental" ||
    input.businessType === "rental" ||
    input.businessType === "property"
  ) {
    return "rental_reservation";
  }

  if (input.kind === "booking") {
    return "service_booking";
  }

  if (
    input.businessType === "store" ||
    input.businessType === "product" ||
    input.businessType === "creator"
  ) {
    return "store_order";
  }

  if (input.kind === "order") {
    return "food_order";
  }

  return null;
}

function getSourceTable(flowType: FlowType | null): SourceTable | null {
  if (flowType === "service_booking") {
    return "bookings";
  }

  if (flowType === "rental_reservation") {
    return "rental_reservations";
  }

  if (flowType === "food_order" || flowType === "store_order") {
    return "orders";
  }

  return null;
}

function normalizeCheckoutIntent(row: JsonRecord): NormalizedCheckoutIntent | null {
  const metadata = asRecord(row.metadata ?? row.meta_json);
  const kindValue =
    asString(row.kind) ||
    asString(row.intent_type) ||
    asString(metadata.kind) ||
    asString(metadata.intent_type);
  const kind = kindValue === "order" || kindValue === "booking" ? kindValue : null;
  const businessType =
    asString(row.business_type) || asString(metadata.business_type);
  const flowType = inferFlowType({ kind, metadata, businessType });
  const sourceTable = getSourceTable(flowType);
  const id = asString(row.id);

  if (!id) {
    return null;
  }

  return {
    raw: row,
    id,
    businessId: asString(row.business_id),
    businessType,
    kind,
    status: asString(row.status),
    customerName: asString(row.customer_name),
    customerEmail: asString(row.customer_email),
    phone:
      asString(row.phone) ||
      asString(row.customer_phone) ||
      asString(metadata.phone),
    fulfillmentType:
      asString(row.fulfillment_type) ||
      asString(metadata.fulfillment_type) ||
      asString(metadata.service_mode),
    address: asRecord(row.address_json),
    items: normalizeOrderItems(
      row.order_items ?? row.items_json ?? metadata.order_items
    ),
    metadata,
    totalCents: asNumber(row.amount_total ?? row.total_cents ?? metadata.amount_total),
    platformFeeCents: asNumber(
      row.platform_fee_cents ?? metadata.application_fee_cents ?? metadata.platform_fee
    ),
    stripeCheckoutSessionId:
      asString(row.stripe_checkout_session_id) || asString(row.stripe_session_id),
    stripePaymentIntentId: asString(row.stripe_payment_intent_id),
    flowType,
    sourceTable,
  };
}

function buildSyntheticIntentFromSession(
  session: Stripe.Checkout.Session
): NormalizedCheckoutIntent | null {
  const metadata = getSessionMetadata(session);
  const kindValue =
    asString(metadata.intent_type) ||
    asString(metadata.kind) ||
    (session.mode === "payment" ? "booking" : null);
  const kind = kindValue === "order" || kindValue === "booking" ? kindValue : null;

  if (!kind) {
    return null;
  }

  const businessType = asString(metadata.business_type);
  const flowType = inferFlowType({ kind, metadata, businessType });
  const sourceTable = getSourceTable(flowType);
  const customerDetails = session.customer_details || null;

  return {
    raw: {
      id: buildSyntheticIntentId(session),
      metadata,
      business_id: asString(metadata.business_id),
      kind,
      status: isPaidSession(session) ? "paid" : session.status || session.payment_status || "open",
      customer_name:
        asString(metadata.customer_name) ||
        asString(metadata.guest_name) ||
        customerDetails?.name ||
        null,
      customer_email:
        asString(metadata.customer_email) ||
        asString(metadata.guest_email) ||
        customerDetails?.email ||
        null,
      phone:
        asString(metadata.customer_phone) ||
        asString(metadata.guest_phone) ||
        customerDetails?.phone ||
        null,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: asString(session.payment_intent),
    },
    id: buildSyntheticIntentId(session),
    businessId: asString(metadata.business_id),
    businessType,
    kind,
    status: isPaidSession(session) ? "paid" : session.status || session.payment_status || "open",
    customerName:
      asString(metadata.customer_name) ||
      asString(metadata.guest_name) ||
      customerDetails?.name ||
      null,
    customerEmail:
      asString(metadata.customer_email) ||
      asString(metadata.guest_email) ||
      customerDetails?.email ||
      null,
    phone:
      asString(metadata.customer_phone) ||
      asString(metadata.guest_phone) ||
      customerDetails?.phone ||
      null,
    fulfillmentType:
      asString(metadata.fulfillment_type) || asString(metadata.service_mode),
    address: asRecord(metadata.address_json ?? metadata.address),
    items: normalizeOrderItems(metadata.order_items),
    metadata,
    totalCents: asNumber(metadata.amount_total || session.amount_total),
    platformFeeCents: asNumber(metadata.platform_fee),
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: asString(session.payment_intent),
    flowType,
    sourceTable,
  };
}

function buildVerificationSessionFromIntent(
  sessionId: string,
  intent: NormalizedCheckoutIntent
): Stripe.Checkout.Session {
  return {
    id: sessionId,
    object: "checkout.session",
    mode: "payment",
    status: "complete",
    payment_status: "paid",
    amount_total: intent.totalCents || null,
    customer_email: intent.customerEmail || undefined,
    customer_details: {
      email: intent.customerEmail || undefined,
      name: intent.customerName || undefined,
      phone: intent.phone || undefined,
    },
    payment_intent:
      intent.stripePaymentIntentId || `verify_pi_${sessionId.replace(/^verify_cs_/, "")}`,
    metadata: {
      ...intent.metadata,
      checkout_intent_id: intent.id,
      business_id: intent.businessId || "",
      business_type: intent.businessType || "",
      intent_type: intent.kind || "",
      flow_type: intent.flowType || "",
      customer_name: intent.customerName || "",
      customer_email: intent.customerEmail || "",
      customer_phone: intent.phone || "",
      amount_total: String(intent.totalCents || 0),
      platform_fee: String(intent.platformFeeCents || 0),
    },
  } as unknown as Stripe.Checkout.Session;
}

function mergeIntentWithSessionMetadata(
  intent: NormalizedCheckoutIntent,
  session: Stripe.Checkout.Session
): NormalizedCheckoutIntent {
  const sessionMetadata = getSessionMetadata(session);
  const metadata = {
    ...intent.metadata,
    ...sessionMetadata,
  };
  const businessType = intent.businessType || asString(sessionMetadata.business_type);
  const flowType = inferFlowType({
    kind: intent.kind,
    metadata,
    businessType,
  });

  return {
    ...intent,
    businessId: intent.businessId || asString(sessionMetadata.business_id),
    businessType,
    customerName:
      intent.customerName ||
      asString(sessionMetadata.customer_name) ||
      asString(sessionMetadata.guest_name) ||
      session.customer_details?.name ||
      null,
    customerEmail:
      intent.customerEmail ||
      asString(sessionMetadata.customer_email) ||
      asString(sessionMetadata.guest_email) ||
      session.customer_details?.email ||
      null,
    phone:
      intent.phone ||
      asString(sessionMetadata.customer_phone) ||
      asString(sessionMetadata.guest_phone) ||
      session.customer_details?.phone ||
      null,
    fulfillmentType:
      intent.fulfillmentType ||
      asString(sessionMetadata.fulfillment_type) ||
      asString(sessionMetadata.service_mode) ||
      null,
    metadata,
    address:
      Object.keys(intent.address).length > 0
        ? intent.address
        : asRecord(sessionMetadata.address_json ?? sessionMetadata.address),
    totalCents:
      intent.totalCents || asNumber(sessionMetadata.amount_total || session.amount_total),
    platformFeeCents:
      intent.platformFeeCents || asNumber(sessionMetadata.platform_fee),
    stripeCheckoutSessionId: intent.stripeCheckoutSessionId || session.id,
    stripePaymentIntentId:
      intent.stripePaymentIntentId || asString(session.payment_intent),
    flowType,
    sourceTable: getSourceTable(flowType),
  };
}

function getLinkedOrderId(intent: NormalizedCheckoutIntent) {
  return (
    asString(intent.raw.order_id) ||
    asString(intent.metadata.order_id) ||
    null
  );
}

function getLinkedBookingId(intent: NormalizedCheckoutIntent) {
  return (
    asString(intent.raw.booking_id) ||
    asString(intent.metadata.booking_id) ||
    null
  );
}

function isOrderFinalized(
  status: string | null | undefined,
  paymentStatus: string | null | undefined
) {
  return paymentStatus === "paid" || status === "received";
}

function isReservationFinalized(
  status: string | null | undefined,
  paymentStatus: string | null | undefined
) {
  return paymentStatus === "paid" || status === "confirmed";
}

function isBookingFinalized(
  status: string | null | undefined,
  paymentStatus: string | null | undefined
) {
  return paymentStatus === "paid" || status === "confirmed";
}

function buildLogContext(
  source: FinalizationSource,
  session: Stripe.Checkout.Session,
  intent: NormalizedCheckoutIntent | null
): FinalizationLogContext {
  return {
    source,
    sessionId: session.id,
    paymentIntentId: asString(session.payment_intent),
    checkoutIntentId: intent?.id || asString(session.metadata?.checkout_intent_id),
    flowType: intent?.flowType || null,
    businessType: intent?.businessType || null,
    sourceTable: intent?.sourceTable || null,
  };
}

async function findCheckoutIntentByIdentifiers({
  sessionId,
  checkoutIntentId,
  orderRef,
  paymentIntentId,
}: {
  sessionId?: string | null;
  checkoutIntentId?: string | null;
  orderRef?: string | null;
  paymentIntentId?: string | null;
}) {
  if (sessionId) {
    const { data } = await supabaseAdmin
      .from("checkout_intents")
      .select("*")
      .eq("stripe_checkout_session_id", sessionId)
      .maybeSingle();

    const normalized = normalizeCheckoutIntent((data || {}) as JsonRecord);
    if (normalized) {
      return normalized;
    }
  }

  if (paymentIntentId) {
    const { data } = await supabaseAdmin
      .from("checkout_intents")
      .select("*")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .maybeSingle();

    const normalized = normalizeCheckoutIntent((data || {}) as JsonRecord);
    if (normalized) {
      return normalized;
    }
  }

  const candidateId = checkoutIntentId || orderRef || null;
  if (candidateId) {
    const { data } = await supabaseAdmin
      .from("checkout_intents")
      .select("*")
      .eq("id", candidateId)
      .maybeSingle();

    const normalized = normalizeCheckoutIntent((data || {}) as JsonRecord);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

async function updateCheckoutIntentPaid(
  intent: NormalizedCheckoutIntent,
  session: Stripe.Checkout.Session,
  linkedRecord: { orderId?: string | null; bookingId?: string | null },
  context: FinalizationLogContext
) {
  const paymentIntentId = asString(session.payment_intent);
  const rawKeys = Object.keys(intent.raw);
  const payload: JsonRecord = {
    status: "paid",
  };

  if (rawKeys.includes("stripe_checkout_session_id")) {
    payload.stripe_checkout_session_id = session.id;
  }
  if (rawKeys.includes("stripe_session_id")) {
    payload.stripe_session_id = session.id;
  }
  if (rawKeys.includes("stripe_payment_intent_id")) {
    payload.stripe_payment_intent_id = paymentIntentId;
  }
  if (rawKeys.includes("paid_at")) {
    payload.paid_at = new Date().toISOString();
  }
  if (linkedRecord.orderId && rawKeys.includes("order_id")) {
    payload.order_id = linkedRecord.orderId;
  }
  if (linkedRecord.bookingId && rawKeys.includes("booking_id")) {
    payload.booking_id = linkedRecord.bookingId;
  }

  const linkedMetadata = {
    ...intent.metadata,
    order_id: linkedRecord.orderId ?? getLinkedOrderId(intent),
    booking_id: linkedRecord.bookingId ?? getLinkedBookingId(intent),
  };

  if (rawKeys.includes("metadata")) {
    payload.metadata = linkedMetadata;
  } else if (rawKeys.includes("meta_json")) {
    payload.meta_json = linkedMetadata;
  }

  const result = await updateCheckoutIntentSafely({
    supabaseAdmin,
    intentId: intent.id,
    payload,
    context: {
      source: context.source,
      sessionId: context.sessionId,
      checkoutIntentId: intent.id,
      flowType: context.flowType,
      businessType: context.businessType,
      sourceTable: context.sourceTable,
    },
  });

  if (!result.ok) {
    console.error("[checkout/finalize]", {
      stage: "checkout_intent_update_degraded",
      ...context,
      sourceTableWritten: "checkout_intents",
      recordId: intent.id,
      finalSuccess: true,
      removedColumns: result.removedColumns,
      message: result.message || "Checkout intent update degraded after domain write",
    });
    return;
  }

  logFinalization("checkout_intent_updated", context, {
    sourceTableWritten: "checkout_intents",
    recordId: intent.id,
    duplicateRetryHandled: false,
    finalSuccess: true,
  });
}

async function incrementDiscountUsageIfNeeded(
  intent: NormalizedCheckoutIntent,
  context: FinalizationLogContext
) {
  const discount = readAppliedDiscount(intent.metadata.discount);
  if (!discount || discount.usageRecorded || !discount.id || !intent.businessId) {
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("discount_codes")
    .select("id, business_id, usage_count")
    .eq("id", discount.id)
    .eq("business_id", intent.businessId)
    .maybeSingle();

  if (error || !data?.id) {
    console.error("[checkout/finalize]", {
      stage: "discount.lookup_failed",
      ...context,
      discountCodeId: discount.id,
      finalSuccess: true,
      message: error?.message || "Discount code lookup failed during finalization",
    });
    return;
  }

  const currentUsageCount = Number(data.usage_count || 0);
  const nextUsageCount = currentUsageCount + 1;
  const { error: updateError } = await supabaseAdmin
    .from("discount_codes")
    .update({ usage_count: nextUsageCount })
    .eq("id", discount.id)
    .eq("business_id", intent.businessId)
    .eq("usage_count", currentUsageCount);

  if (updateError) {
    console.error("[checkout/finalize]", {
      stage: "discount.increment_failed",
      ...context,
      discountCodeId: discount.id,
      finalSuccess: true,
      message: updateError.message || "Discount code usage increment failed",
    });
    return;
  }

  if (!intent.id.startsWith("session:")) {
    const updatedDiscount = {
      ...discount,
      usageCount: nextUsageCount,
      usageRecorded: true,
    };
    const metadata = {
      ...intent.metadata,
      discount: serializeAppliedDiscount(updatedDiscount),
      discount_code: updatedDiscount.code,
      discount_amount_cents: updatedDiscount.discountAmountCents,
    };
    const payload: JsonRecord = {};
    const rawKeys = Object.keys(intent.raw);
    if (rawKeys.includes("metadata")) {
      payload.metadata = metadata;
    } else if (rawKeys.includes("meta_json")) {
      payload.meta_json = metadata;
    }

    if (Object.keys(payload).length > 0) {
      await updateCheckoutIntentSafely({
        supabaseAdmin,
        intentId: intent.id,
        payload,
        context: {
          source: context.source,
          sessionId: context.sessionId,
          checkoutIntentId: intent.id,
          flowType: context.flowType,
          businessType: context.businessType,
          sourceTable: context.sourceTable,
          stage: "discount_usage_recorded",
        },
      });
    }
  }
}

async function findExistingOrder(
  sessionId: string,
  paymentIntentId: string | null,
  linkedOrderId: string | null
) {
  const ordersTable = supabaseAdmin.from("orders") as unknown as {
    select: (query: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<MaybeSingleResponse<OrderRow>>;
      };
    };
  };

  if (linkedOrderId) {
    const { data } = await ordersTable.select("id").eq("id", linkedOrderId).maybeSingle();
    if (data?.id) {
      return String(data.id);
    }
  }

  const { data: bySession } = await ordersTable
    .select("id")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  if (bySession?.id) {
    return String(bySession.id);
  }

  if (paymentIntentId) {
    const { data: byPaymentIntent } = await ordersTable
      .select("id")
      .eq("payment_intent_id", paymentIntentId)
      .maybeSingle();
    if (byPaymentIntent?.id) {
      return String(byPaymentIntent.id);
    }
  }

  return null;
}

async function readExistingOrderState(orderId: string) {
  const ordersTable = supabaseAdmin.from("orders") as unknown as {
    select: (query: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<MaybeSingleResponse<OrderRow>>;
      };
    };
  };

  const { data } = await ordersTable
    .select("id, status, payment_status")
    .eq("id", orderId)
    .maybeSingle();

  return data || null;
}

async function createOrderItemsIfPossible(
  orderId: string,
  intent: NormalizedCheckoutIntent,
  context: FinalizationLogContext
) {
  if (intent.items.length === 0 || !intent.businessId) {
    return;
  }

  const orderItemsTable = supabaseAdmin.from("order_items") as unknown as {
    select: (query: string) => {
      eq: (column: string, value: string) => {
        limit: (value: number) => Promise<ManyResponse<OrderItemRow>>;
      };
    };
    insert: (rows: Array<Record<string, unknown>>) => Promise<{
      error: { message: string } | null;
    }>;
  };

  const { data: existingRows, error: existingError } = await orderItemsTable
    .select("id")
    .eq("order_id", orderId)
    .limit(1);

  if (existingError) {
    if (!isMissingSchemaError(existingError.message)) {
      throw new ReconciliationError(
        getErrorDebug("order_items.select_existing", existingError)
      );
    }
    return;
  }

  if ((existingRows || []).length > 0) {
    logFinalization("order_items_duplicate_retry", context, {
      sourceTableWritten: "order_items",
      recordId: orderId,
      duplicateRetryHandled: true,
      finalSuccess: true,
    });
    return;
  }

  const insertRows = intent.items.map((item) => ({
    order_id: orderId,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
  }));

  const { error: insertError } = await orderItemsTable.insert(insertRows);
  if (insertError && !isMissingSchemaError(insertError.message)) {
    logWriteError("order_items.insert", insertRows[0] || {}, insertError, context);
    throw new ReconciliationError(getErrorDebug("order_items.insert", insertError));
  }

  logFinalization("order_items_written", context, {
    sourceTableWritten: "order_items",
    recordId: orderId,
    duplicateRetryHandled: false,
    finalSuccess: true,
    itemCount: insertRows.length,
  });
}

async function upsertOrderFromIntent(
  intent: NormalizedCheckoutIntent,
  session: Stripe.Checkout.Session,
  context: FinalizationLogContext
): Promise<FinalizeWriteResult> {
  if (!intent.businessId) {
    throw new ReconciliationError({
      step: "orders.validate",
      message: "Missing business_id for paid order intent",
    });
  }

  const paymentIntentId = asString(session.payment_intent);
  const existingOrderId = await findExistingOrder(
    session.id,
    paymentIntentId,
    getLinkedOrderId(intent)
  );
  const existingOrder =
    existingOrderId ? await readExistingOrderState(existingOrderId) : null;
  const wasAlreadyFinalized = isOrderFinalized(
    existingOrder?.status,
    existingOrder?.payment_status
  );

  const orderPayload: Record<string, unknown> = {
    business_id: intent.businessId,
    status: "received",
    payment_status: "paid",
    stripe_session_id: session.id,
    payment_intent_id: paymentIntentId,
    customer_name: intent.customerName,
    customer_email:
      intent.customerEmail ||
      asString(intent.metadata.customer_email) ||
      asString(intent.metadata.guest_email),
    customer_phone: intent.phone,
    fulfillment_type: intent.fulfillmentType,
    platform_fee: centsToDollars(intent.platformFeeCents),
    metadata: getSafeMetadataObject({
      ...intent.metadata,
      checkout_intent_id: intent.id,
      address: intent.address,
      notes: asString(intent.metadata.notes),
    }),
    total_amount: (intent.totalCents || asNumber(session.amount_total)) / 100,
  };

  const ordersTable = supabaseAdmin.from("orders") as unknown as {
    update: (payload: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
    };
    insert: (payload: Record<string, unknown>) => {
      select: (query: string) => {
        maybeSingle: () => Promise<MaybeSingleResponse<OrderRow>>;
      };
    };
  };

  let recordId = existingOrderId;
  let recordAction: RecordAction = existingOrderId ? "updated" : "none";
  const duplicateRetryHandled = Boolean(existingOrderId);
  const currentOrderPayload: Record<string, unknown> = { ...orderPayload };

  if (existingOrderId) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const { error } = await ordersTable.update(currentOrderPayload).eq("id", existingOrderId);
      if (!error) {
        break;
      }

      if (!isMissingSchemaError(error.message)) {
        logWriteError("orders.update", currentOrderPayload, error, context);
        throw new ReconciliationError(getErrorDebug("orders.update", error));
      }

      const missingColumn = extractMissingColumnName(error.message);
      if (!missingColumn || !(missingColumn in currentOrderPayload)) {
        logWriteError("orders.update", currentOrderPayload, error, context);
        throw new ReconciliationError(getErrorDebug("orders.update", error));
      }

      delete currentOrderPayload[missingColumn];
      logFinalization("orders_update_retry_without_column", context, {
        recordId: existingOrderId,
        missingColumn,
      });

      if (attempt === 7) {
        logWriteError("orders.update", currentOrderPayload, error, context);
        throw new ReconciliationError(getErrorDebug("orders.update", error));
      }
    }
  } else {
    let inserted = false;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const { data, error } = await ordersTable
        .insert(currentOrderPayload)
        .select("id")
        .maybeSingle();

      if (!error) {
        recordId = data?.id ? String(data.id) : null;
        recordAction = "created";
        inserted = true;
        break;
      }

      if (!isMissingSchemaError(error.message)) {
        logWriteError("orders.insert", currentOrderPayload, error, context);
        throw new ReconciliationError(getErrorDebug("orders.insert", error));
      }

      const missingColumn = extractMissingColumnName(error.message);
      if (!missingColumn || !(missingColumn in currentOrderPayload)) {
        logWriteError("orders.insert", currentOrderPayload, error, context);
        throw new ReconciliationError(getErrorDebug("orders.insert", error));
      }

      delete currentOrderPayload[missingColumn];
      logFinalization("orders_insert_retry_without_column", context, {
        missingColumn,
      });
    }

    if (!inserted && !recordId) {
      throw new ReconciliationError({
        step: "orders.insert",
        message: "Paid order session could not be persisted after schema fallback retries",
      });
    }
  }

  if (!recordId) {
    throw new ReconciliationError({
      step: "orders.finalize",
      message: "Paid order session did not materialize an order record",
    });
  }

  await createOrderItemsIfPossible(recordId, intent, context);

  logFinalization("domain_record_written", context, {
    sourceTableWritten: "orders",
    recordId,
    recordAction,
    duplicateRetryHandled,
    finalSuccess: true,
    hasAddress: hasAddress(intent.address),
    hasNotes: hasNotes(intent.metadata),
  });

  return {
    sourceTable: "orders",
    recordId,
    recordAction,
    reusedOperationalRecord: duplicateRetryHandled,
    duplicateRetryHandled,
    confirmationEmailEligible: !wasAlreadyFinalized,
  };
}

async function findExistingRentalReservation(
  sessionId: string,
  paymentIntentId: string | null,
  intent: NormalizedCheckoutIntent
) {
  const reservationsTable = supabaseAdmin.from("rental_reservations") as unknown as {
    select: (query: string) => {
      eq: (column: string, value: string) => {
        eq: (column2: string, value2: string) => {
          eq: (column3: string, value3: string) => {
            eq: (column4: string, value4: string) => {
              maybeSingle: () => Promise<MaybeSingleResponse<ReservationRow>>;
            };
          };
        };
        maybeSingle: () => Promise<MaybeSingleResponse<ReservationRow>>;
      };
    };
  };

  const linkedBookingId = getLinkedBookingId(intent);
  if (linkedBookingId) {
    const { data } = await reservationsTable.select("id").eq("id", linkedBookingId).maybeSingle();
    if (data?.id) {
      return String(data.id);
    }
  }

  const { data: bySession } = await reservationsTable
    .select("id")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  if (bySession?.id) {
    return String(bySession.id);
  }

  if (paymentIntentId) {
    const { data: byPaymentIntent } = await reservationsTable
      .select("id")
      .eq("payment_intent_id", paymentIntentId)
      .maybeSingle();
    if (byPaymentIntent?.id) {
      return String(byPaymentIntent.id);
    }
  }

  const startDate =
    asString(intent.metadata.start_date) || asString(intent.metadata.check_in_date);
  const endDate =
    asString(intent.metadata.end_date) || asString(intent.metadata.check_out_date);
  const propertyId = asString(intent.metadata.property_id);

  if (intent.businessId && startDate && endDate && propertyId) {
    const { data: byRange } = await reservationsTable
      .select("id")
      .eq("business_id", intent.businessId)
      .eq("property_id", propertyId)
      .eq("check_in_date", startDate)
      .eq("check_out_date", endDate)
      .maybeSingle();

    if (byRange?.id) {
      return String(byRange.id);
    }
  }

  return null;
}

async function readExistingRentalReservationState(reservationId: string) {
  const reservationsTable = supabaseAdmin.from("rental_reservations") as unknown as {
    select: (query: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<MaybeSingleResponse<ReservationRow>>;
      };
    };
  };

  const { data } = await reservationsTable
    .select("id, status, payment_status")
    .eq("id", reservationId)
    .maybeSingle();

  return data || null;
}

async function findExistingServiceBooking(
  sessionId: string,
  paymentIntentId: string | null,
  intent: NormalizedCheckoutIntent
) {
  const bookingsTable = supabaseAdmin.from("bookings") as unknown as {
    select: (query: string) => {
      eq: (column: string, value: string) => {
        eq: (column2: string, value2: string) => {
          eq: (column3: string, value3: string) => {
            eq: (column4: string, value4: string) => {
              maybeSingle: () => Promise<MaybeSingleResponse<BookingRow>>;
            };
          };
        };
        maybeSingle: () => Promise<MaybeSingleResponse<BookingRow>>;
      };
    };
  };

  const linkedBookingId = getLinkedBookingId(intent);
  if (linkedBookingId) {
    const { data } = await bookingsTable.select("id").eq("id", linkedBookingId).maybeSingle();
    if (data?.id) {
      logFinalization(
        "service_booking_existing_match",
        {
          source: "stripe/webhook",
          sessionId,
          paymentIntentId,
          checkoutIntentId: intent.id,
          flowType: intent.flowType,
          businessType: intent.businessType,
          sourceTable: intent.sourceTable,
        },
        {
          matchStrategy: "linked_booking_id",
          bookingId: data.id,
        }
      );
      return String(data.id);
    }
  }

  const { data: bySession } = await bookingsTable
    .select("id")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  if (bySession?.id) {
    logFinalization(
      "service_booking_existing_match",
      {
        source: "stripe/webhook",
        sessionId,
        paymentIntentId,
        checkoutIntentId: intent.id,
        flowType: intent.flowType,
        businessType: intent.businessType,
        sourceTable: intent.sourceTable,
      },
      {
        matchStrategy: "stripe_session_id",
        bookingId: bySession.id,
      }
    );
    return String(bySession.id);
  }

  if (paymentIntentId) {
    const { data: byPaymentIntent } = await bookingsTable
      .select("id")
      .eq("payment_intent_id", paymentIntentId)
      .maybeSingle();
    if (byPaymentIntent?.id) {
      logFinalization(
        "service_booking_existing_match",
        {
          source: "stripe/webhook",
          sessionId,
          paymentIntentId,
          checkoutIntentId: intent.id,
          flowType: intent.flowType,
          businessType: intent.businessType,
          sourceTable: intent.sourceTable,
        },
        {
          matchStrategy: "payment_intent_id",
          bookingId: byPaymentIntent.id,
        }
      );
      return String(byPaymentIntent.id);
    }
  }

  const date = asString(intent.metadata.date);
  const startTime = asString(intent.metadata.start_time);
  const endTime = asString(intent.metadata.end_time);

  if (intent.businessId && date && startTime && endTime) {
    const { data: bySlot } = await bookingsTable
      .select("id")
      .eq("business_id", intent.businessId)
      .eq("date", date)
      .eq("start_time", startTime)
      .eq("end_time", endTime)
      .maybeSingle();

    if (bySlot?.id) {
      logFinalization(
        "service_booking_existing_match",
        {
          source: "stripe/webhook",
          sessionId,
          paymentIntentId,
          checkoutIntentId: intent.id,
          flowType: intent.flowType,
          businessType: intent.businessType,
          sourceTable: intent.sourceTable,
        },
        {
          matchStrategy: "slot_match",
          bookingId: bySlot.id,
          businessId: intent.businessId,
          date,
          startTime,
          endTime,
        }
      );
      return String(bySlot.id);
    }
  }

  logFinalization(
    "service_booking_existing_match_missing",
    {
      source: "stripe/webhook",
      sessionId,
      paymentIntentId,
      checkoutIntentId: intent.id,
      flowType: intent.flowType,
      businessType: intent.businessType,
      sourceTable: intent.sourceTable,
    },
    {
      linkedBookingId,
      businessId: intent.businessId,
      date,
      startTime,
      endTime,
    }
  );

  return null;
}

async function readExistingServiceBookingState(bookingId: string) {
  const bookingsTable = supabaseAdmin.from("bookings") as unknown as {
    select: (query: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<MaybeSingleResponse<BookingRow>>;
      };
    };
  };

  const { data } = await bookingsTable
    .select("id, status, payment_status, guest_email, phone")
    .eq("id", bookingId)
    .maybeSingle();

  return data || null;
}

async function upsertRentalReservationFromIntent(
  intent: NormalizedCheckoutIntent,
  session: Stripe.Checkout.Session,
  context: FinalizationLogContext
): Promise<FinalizeWriteResult> {
  if (!intent.businessId) {
    throw new ReconciliationError({
      step: "rental_reservations.validate",
      message: "Missing business_id for paid rental intent",
    });
  }

  const propertyId = asString(intent.metadata.property_id);
  const checkInDate =
    asString(intent.metadata.check_in_date) ||
    asString(intent.metadata.start_date) ||
    asString(intent.metadata.date);
  const checkOutDate =
    asString(intent.metadata.check_out_date) || asString(intent.metadata.end_date);
  const paymentIntentId = asString(session.payment_intent);

  if (!propertyId || !checkInDate || !checkOutDate) {
    throw new ReconciliationError({
      step: "rental_reservations.validate",
      message: "Missing rental reservation details in checkout intent",
    });
  }

  const existingReservationId = await findExistingRentalReservation(
    session.id,
    paymentIntentId,
    intent
  );
  const existingReservation = existingReservationId
    ? await readExistingRentalReservationState(existingReservationId)
    : null;
  const wasAlreadyFinalized = isReservationFinalized(
    existingReservation?.status,
    existingReservation?.payment_status
  );

  const payload = {
    business_id: intent.businessId,
    property_id: propertyId,
    status: "confirmed",
    payment_status: "paid",
    stripe_session_id: session.id,
    payment_intent_id: paymentIntentId,
    guest_name: intent.customerName,
    guest_email: intent.customerEmail,
    guest_phone: intent.phone,
    check_in_date: checkInDate,
    check_out_date: checkOutDate,
    amount_total: intent.totalCents || asNumber(session.amount_total),
    platform_fee: intent.platformFeeCents,
    metadata: getSafeMetadataObject({
      ...intent.metadata,
      checkout_intent_id: intent.id,
      address: intent.address,
    }),
  };

  const reservationsTable = supabaseAdmin.from("rental_reservations") as unknown as {
    update: (payload: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
    };
    insert: (payload: Record<string, unknown>) => {
      select: (query: string) => {
        maybeSingle: () => Promise<MaybeSingleResponse<ReservationRow>>;
      };
    };
    select: (query: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<MaybeSingleResponse<ReservationRow>>;
      };
    };
  };

  let recordId = existingReservationId;
  let recordAction: RecordAction = existingReservationId ? "updated" : "none";
  const duplicateRetryHandled = Boolean(existingReservationId);

  if (existingReservationId) {
    const { error } = await reservationsTable
      .update(payload)
      .eq("id", existingReservationId);
    if (error) {
      logWriteError("rental_reservations.update", payload, error, context);
      throw new ReconciliationError(
        getErrorDebug("rental_reservations.update", error)
      );
    }
  } else {
    const { data, error } = await reservationsTable
      .insert(payload)
      .select("id")
      .maybeSingle();

    if (error) {
      logWriteError("rental_reservations.insert", payload, error, context);
      throw new ReconciliationError(
        getErrorDebug("rental_reservations.insert", error)
      );
    }

    recordId = data?.id ? String(data.id) : null;
    recordAction = "created";
  }

  if (!recordId) {
    throw new ReconciliationError({
      step: "rental_reservations.finalize",
      message: "Paid rental session did not materialize a reservation record",
    });
  }

  const { data: reservationRow, error: reservationReadError } = await reservationsTable
    .select("id, nights")
    .eq("id", recordId)
    .maybeSingle();

  if (reservationReadError) {
    logWriteError("rental_reservations.read_after_write", payload, reservationReadError, context);
  }

  logFinalization("domain_record_written", context, {
    sourceTableWritten: "rental_reservations",
    recordId,
    recordAction,
    duplicateRetryHandled,
    finalSuccess: true,
    nights: reservationRow?.nights ?? null,
  });

  if (intent.customerEmail) {
    try {
      await upsertConversationForBooking({
        businessId: intent.businessId,
        bookingId: recordId,
        clientEmail: intent.customerEmail,
        clientName: intent.customerName,
        subject: "Reservation details",
      });
    } catch (error) {
      console.error("[checkout/finalize]", {
        stage: "rental_conversation_sync_failed",
        ...context,
        sourceTableWritten: "rental_reservations",
        recordId,
        finalSuccess: false,
        message: error instanceof Error ? error.message : "Unknown conversation sync error",
      });
    }
  }

  return {
    sourceTable: "rental_reservations",
    recordId,
    recordAction,
    reusedOperationalRecord: duplicateRetryHandled,
    duplicateRetryHandled,
    confirmationEmailEligible: !wasAlreadyFinalized,
  };
}

async function upsertServiceBookingFromIntent(
  intent: NormalizedCheckoutIntent,
  session: Stripe.Checkout.Session,
  context: FinalizationLogContext
): Promise<FinalizeWriteResult> {
  if (!intent.businessId) {
    throw new ReconciliationError({
      step: "bookings.validate",
      message: "Missing business_id for paid booking intent",
    });
  }

  const date = asString(intent.metadata.date);
  const startTime = asString(intent.metadata.start_time);
  const endTime = asString(intent.metadata.end_time);
  const paymentIntentId = asString(session.payment_intent);
  const guestName =
    intent.customerName ||
    asString(intent.metadata.guest_name) ||
    asString(intent.metadata.customer_name);
  const guestEmail =
    intent.customerEmail ||
    asString(intent.metadata.guest_email) ||
    asString(intent.metadata.customer_email) ||
    asString(intent.metadata.email);
  const resolvedPhone =
    intent.phone ||
    asString(intent.metadata.guest_phone) ||
    asString(intent.metadata.customer_phone);

  if (!date || !startTime || !endTime) {
    throw new ReconciliationError({
      step: "bookings.validate",
      message: "Missing service booking slot details in checkout intent",
    });
  }

  if (!guestEmail) {
    throw new ReconciliationError({
      step: "bookings.validate",
      message: "Missing guest_email for paid service booking",
    });
  }

  if (!resolvedPhone) {
    throw new ReconciliationError({
      step: "bookings.validate",
      message: "Missing phone for paid service booking",
    });
  }

  const existingBookingId = await findExistingServiceBooking(
    session.id,
    paymentIntentId,
    intent
  );
  const existingBooking = existingBookingId
    ? await readExistingServiceBookingState(existingBookingId)
    : null;
  const wasAlreadyFinalized = isBookingFinalized(
    existingBooking?.status,
    existingBooking?.payment_status
  );
  const bookingTime =
    asString(intent.metadata.booking_time) || buildBookingTime(date, startTime);
  const payloadMetadata = getSafeMetadataObject({
    ...intent.metadata,
    checkout_intent_id: intent.id,
    service_id: asString(intent.metadata.service_id),
    service_name: asString(intent.metadata.service_name),
    service_mode: asString(intent.metadata.service_mode),
    address: intent.address,
  });

  const payload = {
    business_id: intent.businessId,
    guest_name: guestName,
    guest_email: guestEmail,
    guest_phone: resolvedPhone,
    reminder_sent: false,
    date,
    start_time: startTime,
    end_time: endTime,
    status: "confirmed",
    payment_status: "paid",
    stripe_session_id: session.id,
    payment_intent_id: paymentIntentId,
    amount_total: intent.totalCents || asNumber(session.amount_total),
    platform_fee: toBookingPlatformFeeValue(intent.platformFeeCents),
    total_amount: intent.totalCents || asNumber(session.amount_total),
    customer_name: guestName,
    customer_email: guestEmail,
    phone: resolvedPhone,
    client_address: formatAddress(intent.address),
    duration_minutes: null,
    booking_time: bookingTime,
    metadata: payloadMetadata,
  };

  logFinalization("service_booking_payload_prepared", context, {
    businessId: intent.businessId,
    serviceId: asString(intent.metadata.service_id),
    customerEmail: intent.customerEmail,
    guestEmailResolved: Boolean(guestEmail),
    phoneResolved: Boolean(resolvedPhone),
    payloadKeys: Object.keys(payload),
    amountTotal: payload.amount_total,
  });

  const bookingsTable = supabaseAdmin.from("bookings") as unknown as {
    update: (payload: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
    };
    insert: (payload: Record<string, unknown>) => {
      select: (query: string) => {
        maybeSingle: () => Promise<MaybeSingleResponse<BookingRow>>;
      };
    };
  };

  let recordId = existingBookingId;
  let recordAction: RecordAction = existingBookingId ? "updated" : "none";
  let duplicateRetryHandled = Boolean(existingBookingId);

  if (existingBookingId) {
    const { error } = await bookingsTable.update(payload).eq("id", existingBookingId);
    if (error) {
      logWriteError("bookings.update", payload, error, context);
      throw new ReconciliationError(getErrorDebug("bookings.update", error));
    }

    logFinalization("service_booking_update_success", context, {
      businessId: intent.businessId,
      serviceId: asString(intent.metadata.service_id),
      bookingId: existingBookingId,
      amountTotal: payload.amount_total,
      finalBookingStatus: payload.status,
      payloadKeys: Object.keys(payload),
    });
  } else {
    const { data, error } = await bookingsTable
      .insert(payload)
      .select("id")
      .maybeSingle();

    if (error && isRetryableWriteConflict(error.message)) {
      logFinalization("service_booking_insert_conflict", context, {
        businessId: intent.businessId,
        serviceId: asString(intent.metadata.service_id),
        customerEmail: intent.customerEmail,
        finalSuccess: false,
        message: error.message,
      });

      const conflictedBookingId = await findExistingServiceBooking(
        session.id,
        paymentIntentId,
        intent
      );

      if (!conflictedBookingId) {
        logWriteError("bookings.insert", payload, error, context);
        throw new ReconciliationError(getErrorDebug("bookings.insert", error));
      }

      const { error: retryUpdateError } = await bookingsTable
        .update(payload)
        .eq("id", conflictedBookingId);

      if (retryUpdateError) {
        logWriteError("bookings.update_after_conflict", payload, retryUpdateError, context);
        throw new ReconciliationError(
          getErrorDebug("bookings.update_after_conflict", retryUpdateError)
        );
      }

      recordId = conflictedBookingId;
      recordAction = "updated";
      duplicateRetryHandled = true;

      logFinalization("service_booking_update_success", context, {
        businessId: intent.businessId,
        serviceId: asString(intent.metadata.service_id),
        bookingId: conflictedBookingId,
        amountTotal: payload.amount_total,
        finalBookingStatus: payload.status,
        payloadKeys: Object.keys(payload),
      });
    } else if (error) {
      logWriteError("bookings.insert", payload, error, context);
      throw new ReconciliationError(getErrorDebug("bookings.insert", error));
    }

    if (!recordId) {
      recordId = data?.id ? String(data.id) : null;
      recordAction = "created";
    }

    if (recordId && recordAction === "created") {
      logFinalization("service_booking_insert_success", context, {
        businessId: intent.businessId,
        serviceId: asString(intent.metadata.service_id),
        bookingId: recordId,
        amountTotal: payload.amount_total,
        finalBookingStatus: payload.status,
        payloadKeys: Object.keys(payload),
      });
    }
  }

  if (!recordId) {
    throw new ReconciliationError({
      step: "bookings.finalize",
      message: "Paid service booking session did not materialize a booking record",
    });
  }

  const finalizedBooking = await readExistingServiceBookingState(recordId);

  logFinalization("domain_record_written", context, {
    sourceTableWritten: "bookings",
    recordId,
    recordAction,
    duplicateRetryHandled,
    finalSuccess: true,
    businessId: intent.businessId,
    serviceId: asString(intent.metadata.service_id),
    customerEmail: intent.customerEmail,
    guestEmailResolved: Boolean(guestEmail),
    phoneResolved: Boolean(resolvedPhone),
    amountTotal: payload.amount_total,
    serviceName: asString(intent.metadata.service_name),
    finalBookingStatus: finalizedBooking?.status || "confirmed",
    finalPaymentStatus: finalizedBooking?.payment_status || "paid",
    hasAddress: hasAddress(intent.address),
    hasNotes: hasNotes(intent.metadata),
  });

  if (guestEmail) {
    try {
      await upsertConversationForBooking({
        businessId: intent.businessId,
        bookingId: recordId,
        clientEmail: guestEmail,
        clientName: guestName,
        subject: "Booking details",
      });
    } catch (error) {
      console.error("[checkout/finalize]", {
        stage: "booking_conversation_sync_failed",
        ...context,
        sourceTableWritten: "bookings",
        recordId,
        finalSuccess: false,
        message: error instanceof Error ? error.message : "Unknown conversation sync error",
      });
    }
  }

  return {
    sourceTable: "bookings",
    recordId,
    recordAction,
    reusedOperationalRecord: duplicateRetryHandled,
    duplicateRetryHandled,
    confirmationEmailEligible: !wasAlreadyFinalized,
  };
}

async function upsertDomainRecordFromIntent(
  intent: NormalizedCheckoutIntent,
  session: Stripe.Checkout.Session,
  context: FinalizationLogContext
): Promise<FinalizeWriteResult> {
  if (intent.sourceTable === "orders") {
    return upsertOrderFromIntent(intent, session, context);
  }

  if (intent.sourceTable === "rental_reservations") {
    return upsertRentalReservationFromIntent(intent, session, context);
  }

  if (intent.sourceTable === "bookings") {
    return upsertServiceBookingFromIntent(intent, session, context);
  }

  throw new ReconciliationError({
    step: "domain.resolve",
    message: "Could not resolve the source-of-truth table for this paid session",
  });
}

export async function finalizeCheckoutSession({
  sessionId,
  orderRef,
  source,
  providedSession,
}: {
  sessionId: string;
  orderRef?: string | null;
  source: FinalizationSource;
  providedSession?: Stripe.Checkout.Session;
}): Promise<FinalizationResult> {
  try {
    let session = providedSession || null;
    let intent = sessionId
      ? await findCheckoutIntentByIdentifiers({
          sessionId,
          checkoutIntentId: orderRef || null,
          orderRef,
          paymentIntentId: null,
        })
      : null;

    if (!session) {
      if (sessionId.startsWith("verify_cs_") && intent) {
        session = buildVerificationSessionFromIntent(sessionId, intent);
      } else {
        session = await stripe.checkout.sessions.retrieve(sessionId);
      }
    }

    const paymentIntentId = asString(session.payment_intent);
    const checkoutIntentId =
      asString(session.metadata?.checkout_intent_id) || orderRef || null;

    if (!intent) {
      intent = await findCheckoutIntentByIdentifiers({
        sessionId: session.id,
        checkoutIntentId,
        orderRef,
        paymentIntentId,
      });
    }

    const resolvedIntent = intent
      ? mergeIntentWithSessionMetadata(intent, session)
      : buildSyntheticIntentFromSession(session);
    const context = buildLogContext(source, session, resolvedIntent);

    logFinalization("start", context, {
      finalSuccess: false,
      paid: isPaidSession(session),
      fallbackIntentUsed: !intent && Boolean(resolvedIntent),
    });

    if (!resolvedIntent) {
      if (isPaidSession(session)) {
        throw new ReconciliationError({
          step: "intent.resolve",
          message: "Paid checkout session could not be resolved to a transaction intent",
        });
      }

      return {
        paid: false,
        status: session.payment_status || session.status || "open",
        checkoutIntentId,
        orderId: null,
        bookingId: null,
        paymentStatus: null,
        orderStatus: null,
        updatedIntent: false,
        reusedOperationalRecord: false,
        duplicateRetryHandled: false,
        flowType: null,
        businessType: null,
        sourceTable: null,
        recordId: null,
        recordAction: "none",
      };
    }

    if (!isPaidSession(session)) {
      logFinalization("not_paid", context, {
        finalSuccess: false,
        duplicateRetryHandled: false,
      });

      return {
        paid: false,
        status: session.payment_status || session.status || resolvedIntent.status || "open",
        checkoutIntentId: resolvedIntent.id,
        orderId: null,
        bookingId: null,
        paymentStatus: null,
        orderStatus: null,
        updatedIntent: false,
        reusedOperationalRecord: false,
        duplicateRetryHandled: false,
        flowType: resolvedIntent.flowType,
        businessType: resolvedIntent.businessType,
        sourceTable: resolvedIntent.sourceTable,
        recordId: null,
        recordAction: "none",
      };
    }

    if (!resolvedIntent.businessId) {
      throw new ReconciliationError({
        step: "intent.business_id",
        message: "Paid checkout session is missing business_id metadata",
      });
    }

    if (!resolvedIntent.flowType || !resolvedIntent.sourceTable) {
      throw new ReconciliationError({
        step: "intent.flow_type",
        message: "Paid checkout session is missing a resolvable flow type",
      });
    }

    const writeResult = await upsertDomainRecordFromIntent(
      resolvedIntent,
      session,
      context
    );

    const linkedOrderId =
      writeResult.sourceTable === "orders" ? writeResult.recordId : null;
    const linkedBookingId =
      writeResult.sourceTable === "orders" ? null : writeResult.recordId;

    let updatedIntent = false;
    if (!resolvedIntent.id.startsWith("session:")) {
      await updateCheckoutIntentPaid(
        resolvedIntent,
        session,
        { orderId: linkedOrderId, bookingId: linkedBookingId },
        context
      );
      updatedIntent = true;
    } else {
      console.error("[checkout/finalize]", {
        stage: "synthetic_intent_used",
        ...context,
        sourceTableWritten: writeResult.sourceTable,
        recordId: writeResult.recordId,
        duplicateRetryHandled: writeResult.duplicateRetryHandled,
        finalSuccess: true,
        message:
          "Paid session finalized from session metadata because no checkout_intent row was found.",
      });
    }

    await incrementDiscountUsageIfNeeded(resolvedIntent, context);

    await sendTransactionConfirmationEmail({
      intent: resolvedIntent,
      writeResult,
      context,
    });

    try {
      await createTransactionNotification({
        businessId: resolvedIntent.businessId,
        businessType: resolvedIntent.businessType,
        sourceTable: writeResult.sourceTable,
        recordId: writeResult.recordId,
        flowType: resolvedIntent.flowType,
        recordAction: writeResult.recordAction,
      });
    } catch (notificationError) {
      console.error("[checkout/finalize]", {
        stage: "notification.create",
        sessionId: session.id,
        sourceTable: writeResult.sourceTable,
        recordId: writeResult.recordId,
        message:
          notificationError instanceof Error
            ? notificationError.message
            : "Unknown notification failure",
      });
    }

    const result: FinalizationResult = {
      paid: true,
      status: "paid",
      checkoutIntentId: resolvedIntent.id,
      orderId: writeResult.sourceTable === "orders" ? writeResult.recordId : null,
      bookingId: writeResult.sourceTable === "orders" ? null : writeResult.recordId,
      paymentStatus: "paid",
      orderStatus:
        writeResult.sourceTable === "orders" ? "received" : "confirmed",
      updatedIntent,
      reusedOperationalRecord: writeResult.reusedOperationalRecord,
      duplicateRetryHandled: writeResult.duplicateRetryHandled,
      flowType: resolvedIntent.flowType,
      businessType: resolvedIntent.businessType,
      sourceTable: writeResult.sourceTable,
      recordId: writeResult.recordId,
      recordAction: writeResult.recordAction,
    };

    logFinalization("complete", context, {
      sourceTableWritten: writeResult.sourceTable,
      recordId: writeResult.recordId,
      recordAction: writeResult.recordAction,
      duplicateRetryHandled: writeResult.duplicateRetryHandled,
      businessId: resolvedIntent.businessId,
      serviceId:
        writeResult.sourceTable === "bookings"
          ? asString(resolvedIntent.metadata.service_id)
          : null,
      finalBookingStatus:
        writeResult.sourceTable === "orders" ? "received" : "confirmed",
      finalSuccess: true,
    });

    return result;
  } catch (error: unknown) {
    const debug =
      error instanceof ReconciliationError
        ? error
        : new ReconciliationError(getErrorDebug("reconciliation.finalize", error));

    console.error("[checkout/finalize]", {
      stage: debug.step,
      finalSuccess: false,
      sessionId,
      message: debug.message,
      code: debug.code ?? null,
      details: debug.details ?? null,
      hint: debug.hint ?? null,
      source,
    });

    throw debug;
  }
}
