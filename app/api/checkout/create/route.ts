import { randomUUID } from "crypto";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/appUrl";
import { hasOperationalAccess } from "@/lib/accessPlan";
import { resolveAccessPlanForBusiness } from "@/lib/accessGrants";
import { getFeatureGate, getUsageLimitResult } from "@/lib/planEnforcement";
import { loadBusinessUsageSnapshot } from "@/lib/planUsageServer";
import { stripe } from "@/lib/stripe";
import { fetchCatalogItemsByIds } from "@/lib/catalog";
import {
  calculateDemandScore,
  calculateSlotPrice,
  shouldApplyGapDiscount,
  type PricingRule,
} from "@/lib/pricing/engine";
import { getNetPayoutCents } from "@/lib/planConfig";
import {
  calculatePlatformFeeCents,
  getConfiguredPlatformFee,
} from "@/lib/platformFees";
import {
  getPublicPath,
  isOrderBusinessType,
  isRentalBusinessType,
} from "@/lib/businessModules";
import {
  getTodayDate,
  isActiveRentalBooking,
  normalizeDate,
  overlapsBlockedDateRange,
  overlapsReservationDateRange,
} from "@/lib/rentalAvailability";
import {
  insertCheckoutIntentSafely,
  updateCheckoutIntentSafely,
} from "@/lib/checkoutIntents";
import { finalizeCheckoutSession } from "@/lib/checkoutFinalization";
import { loadMissingLegalDocumentKeysSafe } from "@/lib/legalAcceptance";
import { trackLeadEventServer } from "@/lib/leads.server";
import {
  serializeAppliedDiscount,
  validateDiscountForCheckout,
} from "@/lib/discountCodes";
import { errorResponse, getErrorMessage, logRouteError } from "@/lib/apiErrors";
import { applyVisibleFilter } from "@/lib/transactionVisibility";
import { loadBusinessPreferences } from "@/lib/businessPreferences";
import type { Database } from "@/types/database";

export const runtime = "nodejs";

type AddressInput = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
};

type OrderItemInput = {
  id?: string;
  item_id?: string;
  product_id?: string;
  menu_item_id?: string;
  name?: string;
  title?: string;
  price?: number | string;
  unit_price?: number | string;
  amount?: number | string;
  quantity?: number | string;
  qty?: number | string;
};

type NormalizedOrderItem = {
  id: string | null;
  name: string;
  price: number;
  quantity: number;
  options?: unknown;
};

type UniversalCheckoutType = "service" | "rental" | "food" | "product";

type UniversalCheckoutLineItem = {
  item_id?: string;
  id?: string;
  quantity?: number | string;
  qty?: number | string;
  options?: unknown;
};

type UniversalCheckoutPayload = {
  type?: UniversalCheckoutType;
  business_id?: string;
  item_id?: string;
  price?: number | string;
  promo_code?: string;
  verificationMode?: "draft" | "paid";
  metadata?: {
    customer?: {
      name?: string;
      email?: string;
      phone?: string;
    };
    quantity?: number | string;
    options?: unknown;
    items?: UniversalCheckoutLineItem[];
    service_ids?: string[];
    date?: string;
    start_time?: string;
    end_time?: string;
    check_in?: string;
    check_out?: string;
    timezone?: string;
    fulfillment_type?: "pickup" | "delivery";
    service_mode?: "onsite" | "remote";
    address?: AddressInput;
    notes?: string;
    verification_mode?: "draft" | "paid";
  } & Record<string, unknown>;
};

type CheckoutPayload = {
  intentType?: "order" | "booking";
  businessId?: string;
  businessType?: string;
  propertyId?: string;
  serviceId?: string;
  serviceIds?: string[];
  orderItems?: OrderItemInput[];
  cart?: OrderItemInput[];
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  fulfillmentType?: "pickup" | "delivery";
  serviceMode?: "onsite" | "remote";
  address?: AddressInput;
  items?: OrderItemInput[];
  notes?: string;
  slot?: {
    date?: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
  };
  timezone?: string;
  verificationMode?: "draft" | "paid";
  universalType?: UniversalCheckoutType;
  universalPrice?: number | null;
  universalMetadata?: Record<string, unknown>;
  promoCode?: string;
};

type StripeLikeError = Error & {
  code?: string;
  type?: string;
  statusCode?: number;
};

type CheckoutIntentInsertPayload = {
  business_id: string;
  kind: "order" | "booking";
  status: string;
  customer_name: string;
  customer_email: string | null;
  phone: string;
  currency: "usd";
  address_json: AddressInput;
  order_items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    source?: string | null;
  }> | null;
  metadata: Record<string, unknown>;
  amount_subtotal: number;
  amount_tax: number;
  amount_total: number;
  service_id?: string | null;
  booking_id?: string | null;
  product_id?: string | null;
  rental_id?: string | null;
  property_id?: string | null;
  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  expires_at?: string | null;
  paid_at?: string | null;
};

type SlotBookingRow = Pick<
  Database["public"]["Tables"]["bookings"]["Row"],
  "date" | "start_time" | "end_time" | "created_at" | "status"
>;
type RentalReservationRow = Pick<
  Database["public"]["Tables"]["rental_reservations"]["Row"],
  | "id"
  | "status"
  | "payment_status"
  | "check_in_date"
  | "check_out_date"
>;
type ServiceRow = {
  id: string;
  name: string | null;
  price: number | null;
  business_id: string;
  is_active?: boolean | null;
};

type CheckoutIntentRow = {
  id: string;
  status?: string | null;
  business_id?: string | null;
  kind?: string | null;
  amount_total?: number | null;
  customer_email?: string | null;
  phone?: string | null;
  service_id?: string | null;
  property_id?: string | null;
  rental_id?: string | null;
  booking_id?: string | null;
  stripe_checkout_session_id?: string | null;
  metadata?: Record<string, unknown> | string | null;
  created_at?: string | null;
};

function getBaseUrl(req: Request) {
  return getAppUrl(req);
}

function isNonEmpty(value?: string | null) {
  return Boolean(value && value.trim().length > 0);
}

function normalizeOrderItems(rawOrderItems: unknown): NormalizedOrderItem[] {
  return Array.isArray(rawOrderItems)
    ? rawOrderItems.map((item: unknown) => {
        const raw = (item || {}) as OrderItemInput;
        return {
          id: raw.id ?? raw.item_id ?? raw.product_id ?? raw.menu_item_id ?? null,
          name: String(raw.name ?? raw.title ?? "").trim(),
          price: Number(raw.price ?? raw.unit_price ?? raw.amount ?? 0),
          quantity: Number(raw.quantity ?? raw.qty ?? 1),
          options:
            typeof (raw as { options?: unknown }).options === "undefined"
              ? undefined
              : (raw as { options?: unknown }).options,
        };
      })
    : [];
}

function asObjectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asUniversalLineItems(value: unknown): UniversalCheckoutLineItem[] {
  return Array.isArray(value)
    ? value.map((item) => asObjectRecord(item) as UniversalCheckoutLineItem)
    : [];
}

function isUniversalCheckoutPayload(value: unknown): value is UniversalCheckoutPayload {
  const record = asObjectRecord(value);
  return (
    record.type === "service" ||
    record.type === "rental" ||
    record.type === "food" ||
    record.type === "product"
  );
}

function normalizeUniversalCheckoutPayload(payload: UniversalCheckoutPayload): CheckoutPayload {
  const metadata = asObjectRecord(payload.metadata);
  const customer = asObjectRecord(metadata.customer);
  const baseLineItems = asUniversalLineItems(metadata.items);
  const fallbackQuantity = Number(metadata.quantity ?? 1);
  const itemId = String(payload.item_id || "").trim();
  const universalItems =
    baseLineItems.length > 0
      ? baseLineItems.map((item) => ({
          id: String(item.item_id ?? item.id ?? "").trim(),
          quantity: Number(item.quantity ?? item.qty ?? 1),
          options: item.options,
        }))
      : itemId
        ? [
            {
              id: itemId,
              quantity: Number.isFinite(fallbackQuantity) && fallbackQuantity > 0 ? fallbackQuantity : 1,
              options: metadata.options,
            },
          ]
        : [];

  const normalized: CheckoutPayload = {
    businessId: String(payload.business_id || "").trim(),
    customer: {
      name: String(customer.name || "").trim(),
      email: String(customer.email || "").trim(),
      phone: String(customer.phone || "").trim(),
    },
    address: asObjectRecord(metadata.address) as AddressInput,
    notes: typeof metadata.notes === "string" ? metadata.notes : "",
    verificationMode:
      payload.verificationMode === "draft" || payload.verificationMode === "paid"
        ? payload.verificationMode
        : metadata.verification_mode === "draft" || metadata.verification_mode === "paid"
          ? metadata.verification_mode
        : undefined,
    universalType: payload.type,
    universalPrice: Number(payload.price ?? 0) || null,
    universalMetadata: metadata,
    promoCode:
      typeof payload.promo_code === "string"
        ? payload.promo_code
        : typeof metadata.promo_code === "string"
          ? metadata.promo_code
          : undefined,
  };

  if (payload.type === "service") {
    const serviceIds = Array.isArray(metadata.service_ids)
      ? metadata.service_ids.map((id) => String(id || "").trim()).filter(Boolean)
      : itemId
        ? [itemId]
        : [];
    normalized.intentType = "booking";
    normalized.businessType = "service";
    normalized.serviceId = serviceIds[0] || "";
    normalized.serviceIds = serviceIds;
    normalized.serviceMode =
      metadata.service_mode === "onsite" || metadata.service_mode === "remote"
        ? metadata.service_mode
        : undefined;
    normalized.slot = {
      date: typeof metadata.date === "string" ? metadata.date : undefined,
      startTime: typeof metadata.start_time === "string" ? metadata.start_time : undefined,
      endTime: typeof metadata.end_time === "string" ? metadata.end_time : undefined,
    };
    return normalized;
  }

  if (payload.type === "rental") {
    normalized.intentType = "booking";
    normalized.businessType = "rental";
    normalized.propertyId = itemId;
    normalized.timezone = typeof metadata.timezone === "string" ? metadata.timezone : undefined;
    normalized.slot = {
      date: typeof metadata.check_in === "string" ? metadata.check_in : undefined,
      endDate: typeof metadata.check_out === "string" ? metadata.check_out : undefined,
      startTime: "00:00",
      endTime: "23:59",
    };
    return normalized;
  }

  normalized.intentType = "order";
  normalized.businessType = payload.type === "product" ? "product" : "food";
  normalized.fulfillmentType =
    metadata.fulfillment_type === "pickup" || metadata.fulfillment_type === "delivery"
      ? metadata.fulfillment_type
      : undefined;
  normalized.orderItems = universalItems.map((item) => ({
    id: item.id,
    quantity: item.quantity,
    options: item.options,
  }));
  return normalized;
}

function normalizeLegacyCheckoutPayload(value: unknown): CheckoutPayload {
  const record = asObjectRecord(value);
  const payload = record as CheckoutPayload;
  return {
    ...payload,
    promoCode:
      typeof record.promoCode === "string"
        ? record.promoCode
        : typeof record.promo_code === "string"
          ? String(record.promo_code)
          : payload.promoCode,
  };
}

function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map((v) => Number(v));
  return h * 60 + (m || 0);
}

function overlaps(startA: string, endA: string, startB: string, endB: string) {
  return (
    timeToMinutes(startA) < timeToMinutes(endB) &&
    timeToMinutes(endA) > timeToMinutes(startB)
  );
}

function getPublicCancelUrl(args: {
  baseUrl: string;
  businessType: string | null | undefined;
  slug: string | null | undefined;
}) {
  if (args.slug) {
    return `${args.baseUrl}${getPublicPath(args.businessType, args.slug)}`;
  }

  return args.baseUrl;
}

function logCheckoutStage(stage: string, details: Record<string, unknown>) {
  console.log("[checkout/create]", {
    stage,
    ...details,
  });
}

function summarizePayload(payload: CheckoutPayload) {
  const orderItems = payload.orderItems ?? payload.items ?? payload.cart ?? [];
  return {
    intentType: payload.intentType || null,
    businessId: payload.businessId || null,
    businessType: payload.businessType || null,
    serviceId: payload.serviceId || null,
    propertyId: payload.propertyId || null,
    orderItemCount: Array.isArray(orderItems) ? orderItems.length : 0,
    fulfillmentType: payload.fulfillmentType || null,
    serviceMode: payload.serviceMode || null,
    slotDate: payload.slot?.date || null,
    slotEndDate: payload.slot?.endDate || null,
    hasCustomerName: isNonEmpty(payload.customer?.name),
    hasCustomerEmail: isNonEmpty(payload.customer?.email),
    hasCustomerPhone: isNonEmpty(payload.customer?.phone),
  };
}

function normalizeUsdAmountToCents(value: number) {
  return Math.round(value * 100);
}

function isVerificationCheckoutAllowed(args: {
  payload: CheckoutPayload;
  businessSlug: string | null | undefined;
}) {
  if (
    process.env.SERAPH_NON_LIVE_VERIFY !== "1" &&
    process.env.SERAPH_VERIFICATION_MODE !== "1"
  ) {
    return false;
  }

  if (args.payload.verificationMode !== "draft" && args.payload.verificationMode !== "paid") {
    return false;
  }

  return String(args.businessSlug || "").startsWith("verify-");
}

function buildVerificationSession(args: {
  intentId: string | null;
  sessionId?: string | null;
  paymentIntentId?: string | null;
  businessType: string | null | undefined;
  metadata: Record<string, string>;
  totalCents: number;
  customerEmail: string | null;
  baseUrl: string;
  mode: "draft" | "paid";
}) {
  const sessionId =
    args.sessionId || `verify_cs_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const paymentIntentId =
    args.paymentIntentId || `verify_pi_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const isOrder =
    args.metadata.intent_type === "order" ||
    args.metadata.flow_type === "food_order" ||
    args.metadata.flow_type === "store_order";
  const successPath = isOrder ? "/order/success" : "/booking-success";

  return {
    id: sessionId,
    object: "checkout.session",
    mode: "payment",
    status: args.mode === "paid" ? "complete" : "open",
    payment_status: args.mode === "paid" ? "paid" : "unpaid",
    amount_total: args.totalCents,
    customer_email: args.customerEmail || undefined,
    payment_intent: paymentIntentId,
    metadata: args.metadata,
    url:
      args.mode === "paid"
        ? `${args.baseUrl}${successPath}?session_id=${encodeURIComponent(sessionId)}`
        : `${args.baseUrl}${successPath}?session_id=${encodeURIComponent(sessionId)}&verify=1`,
  } as unknown as Stripe.Checkout.Session;
}

async function maybeFinalizeVerificationSession(args: {
  mode: "draft" | "paid";
  session: Stripe.Checkout.Session;
}) {
  if (args.mode !== "paid") {
    return;
  }

  await finalizeCheckoutSession({
    sessionId: args.session.id,
    source: "order-status",
    providedSession: args.session,
    orderRef:
      typeof args.session.metadata?.checkout_intent_id === "string"
        ? args.session.metadata.checkout_intent_id
        : null,
  });
}

function normalizeObjectForFingerprint(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeObjectForFingerprint(entry));
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        const normalized = normalizeObjectForFingerprint(
          (value as Record<string, unknown>)[key]
        );
        if (
          normalized !== null &&
          normalized !== "" &&
          !(Array.isArray(normalized) && normalized.length === 0)
        ) {
          acc[key] = normalized;
        }
        return acc;
      }, {});
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return value ?? null;
}

function buildCheckoutRequestFingerprint(value: Record<string, unknown>) {
  return JSON.stringify(normalizeObjectForFingerprint(value));
}

function getMetadataValue(
  metadata: Record<string, unknown> | string | null | undefined,
  key: string
) {
  if (!metadata) {
    return null;
  }

  const normalized =
    typeof metadata === "string"
      ? (() => {
          try {
            return JSON.parse(metadata) as Record<string, unknown>;
          } catch {
            return {};
          }
        })()
      : metadata;

  const value = normalized?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : value ?? null;
}

function isBlockingServiceBookingStatus(status: string | null | undefined) {
  const normalized = String(status || "").toLowerCase();
  return normalized === "confirmed" || normalized === "completed";
}

function isReusableOpenStripeSession(session: Stripe.Checkout.Session) {
  return (
    session.status === "open" &&
    session.payment_status !== "paid" &&
    typeof session.url === "string" &&
    session.url.length > 0
  );
}

function isMissingHiddenFromUiColumn(error: { code?: string; message?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase();
  return error?.code === "42703" && message.includes("hidden_from_ui");
}

async function loadRentalReservationsWithVisibilityFallback(args: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  businessId: string;
  propertyId: string;
}) {
  const filteredResult = await applyVisibleFilter(
    (args.supabaseAdmin
      .from("rental_reservations")
      .select("id, status, payment_status, check_in_date, check_out_date")
      .eq("business_id", args.businessId)
      .eq("property_id", args.propertyId)
      .order("check_in_date", { ascending: true })) as any
  );

  if (!isMissingHiddenFromUiColumn(filteredResult.error)) {
    return filteredResult;
  }

  console.warn("[checkout/create] rental visibility fallback", {
    businessId: args.businessId,
    propertyId: args.propertyId,
    reason: "hidden_from_ui column missing",
  });

  return args.supabaseAdmin
    .from("rental_reservations")
    .select("id, status, payment_status, check_in_date, check_out_date")
    .eq("business_id", args.businessId)
    .eq("property_id", args.propertyId)
    .order("check_in_date", { ascending: true });
}

async function findMatchingPendingCheckoutIntent(args: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  businessId: string;
  kind: "order" | "booking";
  requestFingerprint: string;
  amountTotal: number;
}) {
  const { data, error } = await args.supabaseAdmin
    .from("checkout_intents")
    .select(
      "id, status, business_id, kind, amount_total, customer_email, phone, service_id, property_id, rental_id, booking_id, stripe_checkout_session_id, metadata, created_at"
    )
    .eq("business_id", args.businessId)
    .eq("kind", args.kind)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    throw new Error(error.message);
  }

  const rows = ((data || []) as CheckoutIntentRow[]).filter((row) => {
    const status = String(row.status || "").toLowerCase();
    return (
      row.amount_total === args.amountTotal &&
      (status === "pending" || status === "open" || status === "") &&
      getMetadataValue(row.metadata, "request_fingerprint") === args.requestFingerprint
    );
  });

  return rows[0] || null;
}

async function maybeReuseOpenCheckoutSession(args: {
  checkoutIntent: CheckoutIntentRow | null;
  baseUrl: string;
}) {
  const sessionId = args.checkoutIntent?.stripe_checkout_session_id || null;
  if (!sessionId) {
    return null;
  }

  if (sessionId.startsWith("verify_cs_")) {
    const successPath =
      args.checkoutIntent?.kind === "order" ? "/order/success" : "/booking-success";
    return {
      sessionId,
      url: `${args.baseUrl}${successPath}?session_id=${encodeURIComponent(sessionId)}&verify=1`,
    };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (isReusableOpenStripeSession(session)) {
      return {
        sessionId: session.id,
        url: session.url as string,
      };
    }
  } catch (error) {
    console.warn("[checkout/create] existing session lookup failed", {
      checkoutIntentId: args.checkoutIntent?.id || null,
      sessionId,
      message: error instanceof Error ? error.message : "Unknown session lookup error",
    });
  }

  return null;
}

export async function POST(req: Request) {
  const isDev = process.env.NODE_ENV !== "production";
  let step = "request.parse";

  try {
    const rawPayload = (await req.json()) as unknown;
    const payload = isUniversalCheckoutPayload(rawPayload)
      ? normalizeUniversalCheckoutPayload(rawPayload)
      : normalizeLegacyCheckoutPayload(rawPayload);
    logCheckoutStage("request_received", summarizePayload(payload));

    const intentType = payload.intentType;
    const businessId = payload.businessId;

    if (!intentType || (intentType !== "order" && intentType !== "booking")) {
      return errorResponse({
        status: 400,
        error: "Select a valid checkout flow before continuing.",
        code: "CHECKOUT_INTENT_TYPE_INVALID",
        step: "request.validate",
      });
    }

    if (!isNonEmpty(businessId)) {
      return errorResponse({
        status: 400,
        error: "Business is required to start checkout.",
        code: "CHECKOUT_BUSINESS_REQUIRED",
        step: "request.validate",
      });
    }

    const safeBusinessId = String(businessId).trim();

    const customerName = payload.customer?.name?.trim() || "";
    const customerEmail = payload.customer?.email?.trim() || "";
    const customerPhone = payload.customer?.phone?.trim() || "";

    if (!isNonEmpty(customerName) || !isNonEmpty(customerPhone)) {
      return errorResponse({
        status: 400,
        error: "Customer name and phone are required to start checkout.",
        code: "CHECKOUT_CUSTOMER_REQUIRED",
        step: "customer.validate",
      });
    }

    if (intentType === "booking" && !isNonEmpty(customerEmail)) {
      return errorResponse({
        status: 400,
        error: "Customer email is required for bookings.",
        code: "CHECKOUT_CUSTOMER_EMAIL_REQUIRED",
        step: "customer.validate",
      });
    }

    const supabaseAdmin = createAdminClient();
    step = "business.read";
    const { data: business, error: businessError } = await supabaseAdmin
      .from("businesses")
      .select(
        "id, owner_id, name, slug, stripe_account_id, stripe_charges_enabled, plan, business_type"
      )
      .eq("id", safeBusinessId)
      .single();

    if (businessError) {
      logRouteError("checkout/create", {
        step,
        code: "CHECKOUT_BUSINESS_READ_FAILED",
        message: businessError.message,
        status: 500,
        error: businessError,
        extra: {
          businessId: safeBusinessId,
          intentType,
        },
      });

      return errorResponse({
        status: 500,
        error: "We couldn't start checkout right now.",
        code: "CHECKOUT_BUSINESS_READ_FAILED",
        step,
      });
    }

    if (!business) {
      return errorResponse({
        status: 404,
        error: "This business is unavailable for checkout.",
        code: "CHECKOUT_BUSINESS_NOT_FOUND",
        step,
      });
    }

    const businessPreferences = await loadBusinessPreferences(
      supabaseAdmin,
      safeBusinessId
    );

    if (!business.stripe_account_id) {
      return errorResponse({
        status: 400,
        error: "This business is not ready to accept payments yet.",
        code: "CHECKOUT_STRIPE_NOT_CONNECTED",
        step: "business.stripe.validate",
      });
    }

    if (!business.stripe_charges_enabled) {
      return errorResponse({
        status: 400,
        error: "This business is not ready to accept payments yet.",
        code: "CHECKOUT_STRIPE_CHARGES_DISABLED",
        step: "business.stripe.validate",
      });
    }

    const normalizedPlan = await resolveAccessPlanForBusiness({
      business: {
        id: business.id,
        owner_id: business.owner_id || null,
        plan: business.plan,
      },
    });

    if (!hasOperationalAccess(normalizedPlan)) {
      return errorResponse({
        status: 403,
        error: "This business is not enabled for checkout yet.",
        code: "CHECKOUT_BUSINESS_ACCESS_INACTIVE",
        step: "business.plan.validate",
      });
    }

    const paymentGate = getFeatureGate(normalizedPlan, "stripe_payments");
    if (!paymentGate.allowed) {
      return errorResponse({
        status: 403,
        error: paymentGate.message || "Payments are locked on this business plan.",
        code: "CHECKOUT_PLAN_PAYMENT_LOCKED",
        step: "business.plan.validate",
      });
    }

    if (business.owner_id) {
      const legalState = await loadMissingLegalDocumentKeysSafe({
        supabase: supabaseAdmin as never,
        userId: business.owner_id,
        businessId: business.id,
        businessType: business.business_type,
      });

      if (!legalState.unavailable && legalState.missingDocumentKeys.length > 0) {
        return errorResponse({
          status: 403,
          error: "This business is not ready to accept live payments yet.",
          code: "CHECKOUT_OWNER_LEGAL_ACCEPTANCE_REQUIRED",
          step: "business.legal.validate",
        });
      }
    }

    const usage = await loadBusinessUsageSnapshot(business.id);
    const transactionLimit = getUsageLimitResult({
      plan: normalizedPlan,
      limitKey: "max_transactions",
      current: Number(usage.max_transactions || 0),
      customMessage:
        "Trial businesses are limited to 10 bookings and orders total. Upgrade to Pro or Elite to continue taking transactions.",
    });

    if (!transactionLimit.allowed) {
      return errorResponse({
        status: 403,
        error: transactionLimit.message || "Transaction limit reached.",
        code: "CHECKOUT_TRANSACTION_LIMIT_REACHED",
        step: "business.plan.validate",
      });
    }

    const platformFee = await getConfiguredPlatformFee(normalizedPlan);
    const feePercent = platformFee.rate;
    const feeBasisPoints = platformFee.basisPoints;
    const verificationMode = isVerificationCheckoutAllowed({
      payload,
      businessSlug: business.slug,
    })
      ? payload.verificationMode || null
      : null;
    logCheckoutStage("business_resolved", {
      businessId: safeBusinessId,
      businessType: business.business_type || null,
      plan: normalizedPlan,
      stripeChargesEnabled: business.stripe_charges_enabled,
      verificationMode,
    });

    const baseUrl = getBaseUrl(req);

    if (intentType === "order") {
      if (!isOrderBusinessType(business.business_type)) {
        return errorResponse({
          status: 400,
          error: "This business type does not support order checkout.",
          code: "CHECKOUT_ORDER_BUSINESS_TYPE_INVALID",
          step: "business.type.validate",
        });
      }

      const isStoreOrder =
        business.business_type === "store" ||
        business.business_type === "product" ||
        business.business_type === "creator";
      const orderFlowType = isStoreOrder ? "store_order" : "food_order";
      const orderCheckoutType = isStoreOrder ? "product" : "food";
      const rawOrderItems = payload.orderItems ?? payload.items ?? payload.cart ?? [];
      const normalizedOrderItems = normalizeOrderItems(rawOrderItems);

      logCheckoutStage("branch_selected", {
        branch: orderFlowType,
        businessId: safeBusinessId,
        businessType: business.business_type || null,
      });
      logCheckoutStage("line_items_resolved", {
        branch: orderFlowType,
        businessId: safeBusinessId,
        rawItemCount: Array.isArray(rawOrderItems) ? rawOrderItems.length : 0,
        normalizedItemCount: normalizedOrderItems.length,
        itemIds: normalizedOrderItems.map((item) => item.id),
      });

      const fulfillmentType = payload.fulfillmentType;
      if (fulfillmentType !== "pickup" && fulfillmentType !== "delivery") {
        return errorResponse({
          status: 400,
          error: "Select pickup or delivery before continuing.",
          code: "CHECKOUT_FULFILLMENT_INVALID",
          step: "order.validate",
        });
      }

      if (fulfillmentType === "pickup" && businessPreferences.pickup_enabled === false) {
        return errorResponse({
          status: 400,
          error: "Pickup is not available for this business.",
          code: "CHECKOUT_PICKUP_DISABLED",
          step: "order.validate",
        });
      }

      if (fulfillmentType === "delivery" && businessPreferences.delivery_enabled === false) {
        return errorResponse({
          status: 400,
          error: "Delivery is not available for this business.",
          code: "CHECKOUT_DELIVERY_DISABLED",
          step: "order.validate",
        });
      }

      if (normalizedOrderItems.length === 0) {
        return errorResponse({
          status: 400,
          error: "Add at least one item before starting checkout.",
          code: "CHECKOUT_ORDER_ITEMS_REQUIRED",
          step: "order.validate",
        });
      }

      const invalidItem = normalizedOrderItems.find(
        (item) =>
          !isNonEmpty(item.id) ||
          !Number.isInteger(item.quantity) ||
          item.quantity <= 0
      );

      if (invalidItem) {
        return errorResponse({
          status: 400,
          error: "One or more items in this order are invalid.",
          code: "CHECKOUT_ORDER_ITEMS_INVALID",
          step: "order.validate",
        });
      }

      const matchedCatalog = await fetchCatalogItemsByIds({
        supabase: supabaseAdmin,
        businessId: safeBusinessId,
        businessType: business.business_type,
        itemIds: normalizedOrderItems.map((item) => item.id as string),
      });

      const dbItemsById = new Map(
        matchedCatalog.items.map((item) => [item.id, item])
      );
      const pricedOrderItems = normalizedOrderItems.map((item) => {
        const dbItem = dbItemsById.get(item.id as string);
        return {
          id: item.id as string,
          name: dbItem?.name || item.name,
          price: dbItem?.price ?? 0,
          quantity: item.quantity,
          source: dbItem?.source || null,
        };
      });

      const invalidPricedItem = pricedOrderItems.find(
        (item) =>
          !isNonEmpty(item.name) ||
          !Number.isFinite(item.price) ||
          item.price <= 0 ||
          !Number.isInteger(item.quantity) ||
          item.quantity <= 0
      );

      if (
        matchedCatalog.items.length !== normalizedOrderItems.length ||
        invalidPricedItem
      ) {
        return errorResponse({
          status: 400,
          error: "One or more items in this order are unavailable.",
          code: "CHECKOUT_ORDER_ITEMS_UNAVAILABLE",
          step: "catalog.validate",
        });
      }

      const subtotalCents = pricedOrderItems.reduce((sum, item) => {
        return sum + Math.round(item.price * 100) * item.quantity;
      }, 0);
      const amountTax = 0;
      const discountValidation = payload.promoCode
        ? await validateDiscountForCheckout({
            supabaseAdmin,
            businessId: safeBusinessId,
            code: payload.promoCode,
            checkoutType: orderCheckoutType,
            subtotalCents,
          })
        : null;
      if (discountValidation && !discountValidation.ok) {
        return errorResponse({
          status: 400,
          error: discountValidation.error,
          code: discountValidation.code,
          step: "discount.validate",
        });
      }
      const appliedDiscount =
        discountValidation && discountValidation.ok ? discountValidation.discount : null;
      const totalBeforeTaxCents = appliedDiscount?.finalTotalCents ?? subtotalCents;
      const totalCents = totalBeforeTaxCents + amountTax;

      logCheckoutStage("amounts_resolved", {
        branch: orderFlowType,
        businessId: safeBusinessId,
        lineItemCount: pricedOrderItems.length,
        subtotal: subtotalCents,
        tax: amountTax,
        total: totalCents,
        discountAmountCents: appliedDiscount?.discountAmountCents ?? 0,
      });

      if (!Number.isFinite(subtotalCents) || subtotalCents <= 0) {
        return errorResponse({
          status: 400,
          error: "We couldn't calculate a valid order total.",
          code: "CHECKOUT_ORDER_TOTAL_INVALID",
          step: "amount.validate",
        });
      }

      if (!Number.isFinite(totalCents) || totalCents <= 0) {
        return errorResponse({
          status: 400,
          error: "Promo code reduces the payable total below the minimum supported amount.",
          code: "CHECKOUT_ORDER_TOTAL_DISCOUNT_INVALID",
          step: "discount.validate",
        });
      }

      const addressInput = payload.address || {};
      const hasDeliveryAddress = Boolean(
        isNonEmpty(addressInput.line1) ||
          isNonEmpty(addressInput.city) ||
          isNonEmpty(addressInput.state) ||
          isNonEmpty(addressInput.postalCode)
      );
      const hasNotes = isNonEmpty(payload.notes);
      if (fulfillmentType === "delivery") {
        if (
          !isNonEmpty(addressInput.line1) ||
          !isNonEmpty(addressInput.city) ||
          !isNonEmpty(addressInput.state) ||
          !isNonEmpty(addressInput.postalCode)
        ) {
          return errorResponse({
            status: 400,
            error: "Delivery address is required for delivery orders.",
            code: "CHECKOUT_DELIVERY_ADDRESS_REQUIRED",
            step: "address.validate",
          });
        }
      }

      const applicationFee = calculatePlatformFeeCents(totalCents, feeBasisPoints);
      const netToBusinessCents = getNetPayoutCents(totalCents, applicationFee);
      const requestFingerprint = buildCheckoutRequestFingerprint({
        kind: "order",
        businessId: safeBusinessId,
        businessType: business.business_type || null,
        customerName,
        customerEmail,
        customerPhone,
        fulfillmentType,
        notes: payload.notes || "",
        address: addressInput,
        orderItems: pricedOrderItems.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          price: item.price,
          options:
            normalizedOrderItems.find((rawItem) => rawItem.id === item.id)?.options ?? null,
        })),
        promoCode: appliedDiscount?.code || payload.promoCode || null,
      });
      logCheckoutStage("fee_resolved", {
        branch: orderFlowType,
        businessId: safeBusinessId,
        feePercent,
        applicationFeeCents: applicationFee,
        netToBusinessCents,
      });
      logCheckoutStage("order_context", {
        branch: orderFlowType,
        businessId: safeBusinessId,
        itemCount: pricedOrderItems.length,
        hasDeliveryAddress,
        hasNotes,
        fulfillmentType,
      });

      try {
        await trackLeadEventServer({
          businessId: safeBusinessId,
          eventType: "checkout_started",
          source: `public:${business.business_type || "order"}`,
          visitor_name: customerName,
          visitor_email: customerEmail || null,
          visitor_phone: customerPhone,
          metadata: {
            intentType,
            fulfillmentType,
            itemCount: pricedOrderItems.length,
            subtotalCents,
            totalCents,
            discountAmountCents: appliedDiscount?.discountAmountCents ?? 0,
          },
        });
      } catch (leadError) {
        console.error("[checkout/create] lead tracking failed:", leadError);
      }

      const intentInsertPayload: CheckoutIntentInsertPayload = {
        business_id: safeBusinessId,
        kind: "order",
        status: "pending",
        customer_name: customerName,
        customer_email: customerEmail || null,
        phone: customerPhone,
        currency: "usd",
        address_json: addressInput,
        order_items: pricedOrderItems,
        metadata: {
          intent_type: "order",
          flow_type: orderFlowType,
          business_type: business.business_type,
          customer_name: customerName,
          customer_email: customerEmail || null,
          customer_phone: customerPhone,
          phone: customerPhone,
          order_items: pricedOrderItems,
          order_request_items: normalizedOrderItems.map((item) => ({
            id: item.id,
            quantity: item.quantity,
            options: item.options ?? null,
          })),
          item_count: pricedOrderItems.length,
          fulfillment_type: fulfillmentType,
          has_delivery_address: hasDeliveryAddress,
          amount_subtotal: subtotalCents,
          amount_tax: amountTax,
          amount_total: totalCents,
          discount: serializeAppliedDiscount(appliedDiscount),
          discount_code: appliedDiscount?.code || null,
          discount_amount_cents: appliedDiscount?.discountAmountCents ?? 0,
          plan: normalizedPlan,
          platform_fee_percent: feePercent,
          platform_fee_bps: feeBasisPoints,
          platform_fee_source: platformFee.source,
          application_fee_cents: applicationFee,
          net_to_business_cents: netToBusinessCents,
          request_fingerprint: requestFingerprint,
          notes: payload.notes || "",
          checkout_type: payload.universalType || orderCheckoutType,
          requested_price: payload.universalPrice,
          checkout_metadata: payload.universalMetadata || null,
        },
        amount_subtotal: subtotalCents,
        amount_tax: amountTax,
        amount_total: totalCents,
        service_id: null,
        booking_id: null,
        product_id: null,
        rental_id: null,
        property_id: null,
        stripe_checkout_session_id: null,
        stripe_payment_intent_id: null,
        expires_at: null,
        paid_at: null,
      };

      let intentId: string | null = null;
      const existingIntent = await findMatchingPendingCheckoutIntent({
        supabaseAdmin,
        businessId: safeBusinessId,
        kind: "order",
        requestFingerprint,
        amountTotal: totalCents,
      });
      const reusableSession =
        verificationMode === "paid"
          ? null
          : await maybeReuseOpenCheckoutSession({
              checkoutIntent: existingIntent,
              baseUrl,
            });

      if (reusableSession) {
        logCheckoutStage("checkout_reused", {
          branch: orderFlowType,
          businessId: safeBusinessId,
          checkoutIntentId: existingIntent?.id || null,
          sessionId: reusableSession.sessionId,
        });
        return NextResponse.json({
          url: reusableSession.url,
          sessionId: reusableSession.sessionId,
          reused: true,
        });
      }

      if (existingIntent?.id && !existingIntent.stripe_checkout_session_id) {
        intentId = existingIntent.id;
      } else {
        logCheckoutStage("db_write_start", {
          branch: orderFlowType,
          target: "checkout_intents",
          action: "insert",
          businessId: safeBusinessId,
          amountTotal: totalCents,
        });

        const intentInsert = await insertCheckoutIntentSafely({
          supabaseAdmin,
          payload: intentInsertPayload,
          context: {
            businessId: safeBusinessId,
            intentType: "order",
            businessType: business.business_type || null,
          },
        });

        intentId = intentInsert.id;
        logCheckoutStage("db_write_success", {
          branch: orderFlowType,
          target: "checkout_intents",
          action: "insert",
          checkoutIntentId: intentId,
          degraded: intentInsert.degraded,
          removedColumns: intentInsert.removedColumns,
        });
      }

      logCheckoutStage("stripe_session_create_start", {
        branch: orderFlowType,
        businessId: safeBusinessId,
        amountTotal: totalCents,
        lineItemCount: pricedOrderItems.length,
      });
      step = "stripe.session.create";
      const orderSuccessUrl = intentId
        ? `${baseUrl}/order/success?session_id={CHECKOUT_SESSION_ID}&order_ref=${intentId}`
        : `${baseUrl}/order/success?session_id={CHECKOUT_SESSION_ID}`;
      const orderSessionMetadata = {
        kind: "checkout_intent",
        intent_type: "order",
        flow_type: orderFlowType,
        checkout_intent_id: intentId || "",
        business_id: safeBusinessId,
        business_type: business.business_type || "",
        customer_name: customerName,
        customer_email: customerEmail || "",
        customer_phone: customerPhone,
        fulfillment_type: fulfillmentType,
        order_items: JSON.stringify(pricedOrderItems),
        order_request_items: JSON.stringify(
          normalizedOrderItems.map((item) => ({
            id: item.id,
            quantity: item.quantity,
            options: item.options ?? null,
          }))
        ),
        address_json: JSON.stringify(addressInput),
        notes: payload.notes || "",
        amount_subtotal: String(subtotalCents),
        amount_total: String(totalCents),
        discount_code_id: appliedDiscount?.id || "",
        discount_code: appliedDiscount?.code || "",
        discount_amount_cents: String(appliedDiscount?.discountAmountCents ?? 0),
        discount_type: appliedDiscount?.discountType || "",
        discount_value: appliedDiscount ? String(appliedDiscount.discountValue) : "",
        discount_applies_to: appliedDiscount?.appliesTo || "",
        platform_fee: String(applicationFee),
        platform_fee_percent: String(feePercent),
        platform_fee_bps: String(feeBasisPoints),
        platform_fee_source: platformFee.source,
        net_to_business_cents: String(netToBusinessCents),
        request_fingerprint: requestFingerprint,
        checkout_type: payload.universalType || orderCheckoutType,
        requested_price: payload.universalPrice ? String(payload.universalPrice) : "",
        checkout_metadata: JSON.stringify(payload.universalMetadata || {}),
      };
      const session =
        verificationMode
          ? buildVerificationSession({
              intentId,
              businessType: business.business_type,
              metadata: orderSessionMetadata,
              totalCents,
              customerEmail: customerEmail || null,
              baseUrl,
              mode: verificationMode,
            })
          : await stripe.checkout.sessions.create({
              mode: "payment",
              customer_email: customerEmail || undefined,
              payment_method_types: ["card"],
              line_items: appliedDiscount
                ? [
                    {
                      quantity: 1,
                      price_data: {
                        currency: "usd",
                        unit_amount: totalCents,
                        product_data: {
                          name: `${business.name || "Order"} checkout`,
                          description: `Promo code ${appliedDiscount.code} applied`,
                        },
                      },
                    },
                  ]
                : pricedOrderItems.map((item) => ({
                    quantity: item.quantity,
                    price_data: {
                      currency: "usd",
                      unit_amount: Math.round(item.price * 100),
                      product_data: {
                        name: item.name || "Item",
                      },
                    },
                  })),
              success_url: orderSuccessUrl,
              cancel_url: getPublicCancelUrl({
                baseUrl,
                businessType: business.business_type,
                slug: business.slug,
              }),
              payment_intent_data: {
                application_fee_amount: applicationFee,
                transfer_data: {
                  destination: business.stripe_account_id,
                },
              },
              metadata: orderSessionMetadata,
            }, {
              idempotencyKey: `checkout:${intentId || requestFingerprint}`,
            });
      logCheckoutStage("stripe_session_create_success", {
        branch: orderFlowType,
        businessId: safeBusinessId,
        sessionId: session.id,
      });

      if (intentId) {
        const sessionUpdateResult = await updateCheckoutIntentSafely({
          supabaseAdmin,
          intentId,
          payload: {
            stripe_checkout_session_id: session.id,
            stripe_payment_intent_id:
              typeof session.payment_intent === "string" ? session.payment_intent : null,
          },
          context: {
            businessId: safeBusinessId,
            intentType: "order",
            businessType: business.business_type || null,
            sessionId: session.id,
          },
        });

        if (!sessionUpdateResult.ok) {
          console.warn("[checkout/create] checkout intent session link degraded", {
            businessId: safeBusinessId,
            intentType: "order",
            checkoutIntentId: intentId,
            sessionId: session.id,
            removedColumns: sessionUpdateResult.removedColumns,
            message: sessionUpdateResult.message,
          });
        }
      }

      await maybeFinalizeVerificationSession({
        mode: verificationMode || "draft",
        session,
      });

      logCheckoutStage("checkout_ready", {
        branch: orderFlowType,
        businessId: safeBusinessId,
        checkoutIntentId: intentId,
        sessionId: session.id,
        itemCount: pricedOrderItems.length,
        totalCents,
      });

      return NextResponse.json({ url: session.url, sessionId: session.id });
    }

    const serviceMode = payload.serviceMode;
    const isRentalBusiness = isRentalBusinessType(business.business_type);
    const requestedServiceIds = Array.from(
      new Set(
        [
          ...(Array.isArray(payload.serviceIds) ? payload.serviceIds : []),
          payload.serviceId,
        ]
          .map((id) => String(id || "").trim())
          .filter(Boolean)
      )
    );
    const serviceId = requestedServiceIds[0] || "";
    logCheckoutStage("branch_selected", {
      branch: isRentalBusiness ? "rental_reservation" : "service_booking",
      businessId: safeBusinessId,
      businessType: business.business_type || null,
      propertyId: payload.propertyId || null,
      serviceId: serviceId || null,
      serviceIds: requestedServiceIds,
    });

    if (!isRentalBusiness && isOrderBusinessType(business.business_type)) {
      return errorResponse({
        status: 400,
        error: "This business type does not support booking checkout.",
        code: "CHECKOUT_BOOKING_BUSINESS_TYPE_INVALID",
        step: "business.type.validate",
      });
    }

    if (!isRentalBusiness && serviceMode !== "onsite" && serviceMode !== "remote") {
      return errorResponse({
        status: 400,
        error: "Select a valid service mode before continuing.",
        code: "CHECKOUT_SERVICE_MODE_INVALID",
        step: "booking.validate",
      });
    }

    if (!isRentalBusiness && serviceMode === "onsite" && businessPreferences.onsite_enabled === false) {
      return errorResponse({
        status: 400,
        error: "On-site service is not available for this business.",
        code: "CHECKOUT_ONSITE_DISABLED",
        step: "booking.validate",
      });
    }

    if (!isRentalBusiness && serviceMode === "remote" && businessPreferences.remote_enabled === false) {
      return errorResponse({
        status: 400,
        error: "Remote service is not available for this business.",
        code: "CHECKOUT_REMOTE_DISABLED",
        step: "booking.validate",
      });
    }

    const slot = payload.slot || {};
    if (!isNonEmpty(slot.date)) {
      return errorResponse({
        status: 400,
        error: "Choose a booking date before continuing.",
        code: "CHECKOUT_BOOKING_SLOT_REQUIRED",
        step: "booking.validate",
      });
    }

    if (
      !isRentalBusiness &&
      (!isNonEmpty(slot.startTime) || !isNonEmpty(slot.endTime))
    ) {
      return errorResponse({
        status: 400,
        error: "Choose a valid booking time before continuing.",
        code: "CHECKOUT_BOOKING_TIME_REQUIRED",
        step: "booking.validate",
      });
    }

    let selectedService: ServiceRow | null = null;
    let selectedServices: ServiceRow[] = [];
    if (!isRentalBusiness) {
      if (requestedServiceIds.length === 0) {
        return errorResponse({
          status: 400,
          error: "Select at least one service before booking.",
          code: "CHECKOUT_SERVICE_REQUIRED",
          step: "service.validate",
        });
      }

      const { data: services } = await supabaseAdmin
        .from("services")
        .select("*")
        .eq("business_id", safeBusinessId)
        .in("id", requestedServiceIds);

      selectedServices = ((services || []) as ServiceRow[]).filter(
        (service) => service.is_active !== false
      );
      const selectedIds = new Set(selectedServices.map((service) => service.id));

      if (
        selectedServices.length !== requestedServiceIds.length ||
        requestedServiceIds.some((id) => !selectedIds.has(id))
      ) {
        console.log("[checkout/create] rejected invalid service selection", {
          businessId: safeBusinessId,
          serviceIds: requestedServiceIds,
          selectionSource: "services",
          rejectedSelection: true,
          rejectionReason: "invalid_service_id",
        });
        return errorResponse({
          status: 404,
          error: "The selected service is unavailable.",
          code: "CHECKOUT_SERVICE_UNAVAILABLE",
          step: "service.read",
        });
      }

      selectedService = selectedServices[0] || null;
      console.log("[checkout/create] service selection source", {
        businessId: safeBusinessId,
        selectionSource: "services",
        serviceId: selectedService?.id || null,
        serviceIds: selectedServices.map((service) => service.id),
        serviceName: selectedService?.name || null,
        serviceNames: selectedServices.map((service) => service.name || "Service"),
        serviceBasePrice: selectedService?.price || null,
        serviceTotalPrice: selectedServices.reduce(
          (sum, service) => sum + Number(service.price || 0),
          0
        ),
        requestedDate: slot.date || null,
        requestedStartTime: slot.startTime || null,
        requestedEndTime: slot.endTime || null,
        serviceMode: serviceMode || null,
      });
    }

    const addressInput = payload.address || {};
    if (!isRentalBusiness && serviceMode === "onsite") {
        if (
          !isNonEmpty(addressInput.line1) ||
          !isNonEmpty(addressInput.city) ||
          !isNonEmpty(addressInput.state) ||
          !isNonEmpty(addressInput.postalCode)
        ) {
          return errorResponse({
            status: 400,
            error: "Address is required for onsite service bookings.",
            code: "CHECKOUT_SERVICE_ADDRESS_REQUIRED",
            step: "address.validate",
          });
        }
      }
    const hasServiceAddress = Boolean(
      isNonEmpty(addressInput.line1) ||
        isNonEmpty(addressInput.city) ||
        isNonEmpty(addressInput.state) ||
        isNonEmpty(addressInput.postalCode)
    );
    const hasServiceNotes = isNonEmpty(payload.notes);

    if (isRentalBusiness) {
      const propertyId = payload.propertyId?.trim() || "";
      const startDate = normalizeDate(slot.date);
      const endDate = normalizeDate(slot.endDate);
      const timeZone = payload.timezone?.trim() || "";

      if (!propertyId || !startDate || !endDate || endDate <= startDate) {
        return errorResponse({
          status: 400,
          error: "Choose a valid reservation date range.",
          code: "CHECKOUT_RENTAL_RANGE_INVALID",
          step: "rental.validate",
        });
      }

      const [{ data: property }, { data: existingReservations }, { data: blockedRanges }] =
        await Promise.all([
          supabaseAdmin
            .from("property")
            .select("id, name, price")
            .eq("id", propertyId)
            .eq("business_id", safeBusinessId)
            .maybeSingle(),
          loadRentalReservationsWithVisibilityFallback({
            supabaseAdmin,
            businessId: safeBusinessId,
            propertyId,
          }),
          supabaseAdmin
            .from("rental_availability_blocks")
            .select("id, start_date, end_date, reason")
            .eq("business_id", safeBusinessId)
            .eq("property_id", propertyId),
        ]);

      if (!property?.id || !Number.isFinite(Number(property.price)) || Number(property.price) <= 0) {
        return errorResponse({
          status: 404,
          error: "This listing is unavailable.",
          code: "CHECKOUT_RENTAL_PROPERTY_UNAVAILABLE",
          step: "property.read",
        });
      }

      const activeReservations = ((existingReservations || []) as RentalReservationRow[]).filter(
        isActiveRentalBooking
      );
      const todayDate = getTodayDate(timeZone || undefined);
      const blockConflicts = (blockedRanges || []).filter((block) => {
        if (!block.start_date || !block.end_date) {
          return false;
        }

        return overlapsBlockedDateRange(
          block.start_date,
          block.end_date,
          startDate,
          endDate
        );
      });
      const reservationConflicts = activeReservations.filter((reservation) => {
        if (!reservation.check_in_date || !reservation.check_out_date) {
          return false;
        }

        return overlapsReservationDateRange(
          reservation.check_in_date,
          reservation.check_out_date,
          startDate,
          endDate
        );
      });
      const availability = {
        available:
          startDate >= todayDate &&
          blockConflicts.length === 0 &&
          reservationConflicts.length === 0,
        reason:
          startDate < todayDate
            ? "past-start-date"
            : blockConflicts.length > 0
              ? "blocked"
              : reservationConflicts.length > 0
                ? "reserved"
                : "available",
        reservationConflicts,
        blockConflicts,
      };

      console.log("[checkout/create] rental availability evaluation", {
        businessId: safeBusinessId,
        propertyId,
        requestedStartDate: startDate,
        requestedEndDate: endDate,
        timeZone: timeZone || null,
        activeReservationCount: activeReservations.length,
        blockedRangeCount: (blockedRanges || []).length,
        reservationConflictCount: availability.reservationConflicts.length,
        blockConflictCount: availability.blockConflicts.length,
        overlapMatches: availability.reservationConflicts.map((reservation) => ({
          id: reservation.id || null,
          checkInDate: reservation.check_in_date || null,
          checkOutDate: reservation.check_out_date || null,
          status: reservation.status || null,
          paymentStatus: reservation.payment_status || null,
        })),
        rejectionReason: availability.available ? null : availability.reason,
      });

      if (!availability.available) {
        return errorResponse({
          status: 409,
          error: "Those dates are no longer available.",
          code: "CHECKOUT_RENTAL_DATES_UNAVAILABLE",
          step: "rental.availability",
        });
      }

      const nights =
        Math.max(
          1,
          Math.round(
            (new Date(`${endDate}T00:00:00.000Z`).getTime() -
              new Date(`${startDate}T00:00:00.000Z`).getTime()) /
              86400000
          )
        );
      const subtotalCents = Math.round(Number(property.price) * nights * 100);
      const amountTax = 0;
      const discountValidation = payload.promoCode
        ? await validateDiscountForCheckout({
            supabaseAdmin,
            businessId: safeBusinessId,
            code: payload.promoCode,
            checkoutType: "rental",
            subtotalCents,
          })
        : null;
      if (discountValidation && !discountValidation.ok) {
        return errorResponse({
          status: 400,
          error: discountValidation.error,
          code: discountValidation.code,
          step: "discount.validate",
        });
      }
      const appliedDiscount =
        discountValidation && discountValidation.ok ? discountValidation.discount : null;
      const totalBeforeTaxCents = appliedDiscount?.finalTotalCents ?? subtotalCents;
      const totalCents = totalBeforeTaxCents + amountTax;
      if (!Number.isFinite(totalCents) || totalCents <= 0) {
        return errorResponse({
          status: 400,
          error: "Promo code reduces the payable total below the minimum supported amount.",
          code: "CHECKOUT_RENTAL_TOTAL_DISCOUNT_INVALID",
          step: "discount.validate",
        });
      }
      const applicationFee = calculatePlatformFeeCents(totalCents, feeBasisPoints);
      const netToBusinessCents = getNetPayoutCents(totalCents, applicationFee);
      const requestFingerprint = buildCheckoutRequestFingerprint({
        kind: "booking",
        flowType: "rental_reservation",
        businessId: safeBusinessId,
        propertyId,
        startDate,
        endDate,
        customerName,
        customerEmail,
        customerPhone,
        notes: payload.notes || "",
        promoCode: appliedDiscount?.code || payload.promoCode || null,
      });

      logCheckoutStage("amounts_resolved", {
        branch: "rental_reservation",
        businessId: safeBusinessId,
        propertyId,
        subtotal: subtotalCents,
        tax: amountTax,
        total: totalCents,
        discountAmountCents: appliedDiscount?.discountAmountCents ?? 0,
      });
      logCheckoutStage("fee_resolved", {
        branch: "rental_reservation",
        businessId: safeBusinessId,
        propertyId,
        feePercent,
        applicationFeeCents: applicationFee,
        netToBusinessCents,
      });

      try {
        console.log("[checkout/create] rental checkout payload", {
          businessId: safeBusinessId,
          propertyId,
          customerName,
          customerEmail,
          customerPhone,
          checkInDate: startDate,
          checkOutDate: endDate,
          nights,
          totalCents,
          applicationFee,
        });

        await trackLeadEventServer({
          businessId: safeBusinessId,
          eventType: "booking_started",
          source: `public:${business.business_type || "rental"}`,
          visitor_name: customerName,
          visitor_email: customerEmail || null,
          visitor_phone: customerPhone,
          metadata: {
            intentType,
            propertyId,
            startDate,
            endDate,
            totalCents,
            discountAmountCents: appliedDiscount?.discountAmountCents ?? 0,
          },
        });
      } catch (leadError) {
        console.error("[checkout/create] lead tracking failed:", leadError);
      }

      const intentInsertPayload: CheckoutIntentInsertPayload = {
        business_id: safeBusinessId,
        kind: "booking",
        status: "pending",
        customer_name: customerName,
        customer_email: customerEmail,
        phone: customerPhone,
        currency: "usd",
        address_json: addressInput,
        order_items: null,
        metadata: {
          intent_type: "booking",
          reservation_type: "rental",
          flow_type: "rental_reservation",
          business_type: business.business_type,
          property_id: propertyId,
          property_name: property.name,
          guest_name: customerName,
          guest_email: customerEmail,
          guest_phone: customerPhone,
          check_in_date: startDate,
          check_out_date: endDate,
          start_date: startDate,
          end_date: endDate,
          nights,
          phone: customerPhone,
          amount_subtotal: subtotalCents,
          amount_tax: amountTax,
          amount_total: totalCents,
          discount: serializeAppliedDiscount(appliedDiscount),
          discount_code: appliedDiscount?.code || null,
          discount_amount_cents: appliedDiscount?.discountAmountCents ?? 0,
          plan: normalizedPlan,
          platform_fee_percent: feePercent,
          platform_fee_bps: feeBasisPoints,
          platform_fee_source: platformFee.source,
          application_fee_cents: applicationFee,
          net_to_business_cents: netToBusinessCents,
          request_fingerprint: requestFingerprint,
          notes: payload.notes || "",
        },
        amount_subtotal: subtotalCents,
        amount_tax: amountTax,
        amount_total: totalCents,
        service_id: null,
        booking_id: null,
        product_id: null,
        rental_id: business.business_type === "rental" ? propertyId : null,
        property_id: business.business_type === "property" ? propertyId : null,
        stripe_checkout_session_id: null,
        stripe_payment_intent_id: null,
        expires_at: null,
        paid_at: null,
      };

      let intentId: string | null = null;
      const existingIntent = await findMatchingPendingCheckoutIntent({
        supabaseAdmin,
        businessId: safeBusinessId,
        kind: "booking",
        requestFingerprint,
        amountTotal: totalCents,
      });
      const reusableSession = await maybeReuseOpenCheckoutSession({
        checkoutIntent: existingIntent,
        baseUrl,
      });

      if (reusableSession) {
        logCheckoutStage("checkout_reused", {
          branch: "rental_reservation",
          businessId: safeBusinessId,
          checkoutIntentId: existingIntent?.id || null,
          propertyId,
          sessionId: reusableSession.sessionId,
        });
        return NextResponse.json({
          url: reusableSession.url,
          sessionId: reusableSession.sessionId,
          reused: true,
        });
      }

      if (existingIntent?.id && !existingIntent.stripe_checkout_session_id) {
        intentId = existingIntent.id;
      } else {
        logCheckoutStage("db_write_start", {
          branch: "rental_reservation",
          target: "checkout_intents",
          action: "insert",
          businessId: safeBusinessId,
          propertyId,
          amountTotal: totalCents,
        });

        const intentInsert = await insertCheckoutIntentSafely({
          supabaseAdmin,
          payload: intentInsertPayload,
          context: {
            businessId: safeBusinessId,
            intentType: "booking",
            flowType: "rental_reservation",
            businessType: business.business_type || null,
          },
        });

        intentId = intentInsert.id;
        logCheckoutStage("db_write_success", {
          branch: "rental_reservation",
          target: "checkout_intents",
          action: "insert",
          checkoutIntentId: intentId,
          degraded: intentInsert.degraded,
          removedColumns: intentInsert.removedColumns,
        });
      }

      const rentalSessionMetadata = {
        kind: "checkout_intent",
        intent_type: "booking",
        reservation_type: "rental",
        flow_type: "rental_reservation",
        checkout_intent_id: intentId || "",
        business_id: safeBusinessId,
        business_type: business.business_type || "",
        property_id: propertyId,
        check_in_date: startDate,
        check_out_date: endDate,
        start_date: startDate,
        end_date: endDate,
        guest_name: customerName,
        guest_email: customerEmail,
        guest_phone: customerPhone,
        notes: payload.notes || "",
        amount_subtotal: String(subtotalCents),
        amount_total: String(totalCents),
        discount_code_id: appliedDiscount?.id || "",
        discount_code: appliedDiscount?.code || "",
        discount_amount_cents: String(appliedDiscount?.discountAmountCents ?? 0),
        discount_type: appliedDiscount?.discountType || "",
        discount_value: appliedDiscount ? String(appliedDiscount.discountValue) : "",
        discount_applies_to: appliedDiscount?.appliesTo || "",
        platform_fee: String(applicationFee),
        platform_fee_percent: String(feePercent),
        platform_fee_bps: String(feeBasisPoints),
        platform_fee_source: platformFee.source,
        net_to_business_cents: String(netToBusinessCents),
        request_fingerprint: requestFingerprint,
      };
      logCheckoutStage("stripe_session_create_start", {
        branch: "rental_reservation",
        businessId: safeBusinessId,
        propertyId,
        amountTotal: totalCents,
      });

      step = "stripe.session.create";
      const session =
        verificationMode
          ? buildVerificationSession({
              intentId,
              businessType: business.business_type,
              metadata: rentalSessionMetadata,
              totalCents,
              customerEmail,
              baseUrl,
              mode: verificationMode,
            })
          : await stripe.checkout.sessions.create({
              mode: "payment",
              customer_email: customerEmail,
              payment_method_types: ["card"],
              line_items: [
                {
                  quantity: 1,
                  price_data: {
                    currency: "usd",
                    unit_amount: totalCents,
                    product_data: {
                      name: `${property.name || business.name} stay`,
                      description: `${startDate} to ${endDate}`,
                    },
                  },
                },
              ],
              success_url: `${baseUrl}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
              cancel_url: `${baseUrl}/rent/${business.slug || ""}`,
              payment_intent_data: {
                application_fee_amount: applicationFee,
                transfer_data: {
                  destination: business.stripe_account_id,
                },
              },
              metadata: rentalSessionMetadata,
            }, {
              idempotencyKey: `checkout:${intentId || requestFingerprint}`,
            });
      logCheckoutStage("stripe_session_create_success", {
        branch: "rental_reservation",
        businessId: safeBusinessId,
        propertyId,
        sessionId: session.id,
      });

      if (intentId) {
        const sessionUpdateResult = await updateCheckoutIntentSafely({
          supabaseAdmin,
          intentId,
          payload: {
            stripe_checkout_session_id: session.id,
            stripe_payment_intent_id:
              typeof session.payment_intent === "string" ? session.payment_intent : null,
          },
          context: {
            businessId: safeBusinessId,
            intentType: "booking",
            flowType: "rental_reservation",
            businessType: business.business_type || null,
            sessionId: session.id,
          },
        });

        if (!sessionUpdateResult.ok) {
          console.warn("[checkout/create] checkout intent session link degraded", {
            businessId: safeBusinessId,
            intentType: "booking",
            flowType: "rental_reservation",
            checkoutIntentId: intentId,
            sessionId: session.id,
            removedColumns: sessionUpdateResult.removedColumns,
            message: sessionUpdateResult.message,
          });
        }
      }

      await maybeFinalizeVerificationSession({
        mode: verificationMode || "draft",
        session,
      });

      return NextResponse.json({ url: session.url, sessionId: session.id });
    }

    const bookingsResult = (await applyVisibleFilter(
      (supabaseAdmin
        .from("bookings")
        .select("start_time, end_time, status")
        .eq("business_id", safeBusinessId)
        .eq("date", slot.date)) as any
    )) as { data: SlotBookingRow[] | null };
    const bookings = (bookingsResult.data || []).filter((booking) =>
      isBlockingServiceBookingStatus(booking.status)
    );

    const bookingSlot = {
      date: slot.date,
      start: slot.startTime,
      end: slot.endTime,
    } as {
      date: string;
      start: string;
      end: string;
    };

    const bookingRows = bookings as SlotBookingRow[];

    const bookingsForPricing: SlotBookingRow[] = bookingRows.map((booking) => ({
      ...booking,
      date: slot.date || null,
    }));

    const hasOverlap = bookingRows.some((booking) => {
      if (!booking.start_time || !booking.end_time) return false;
      return overlaps(slot.startTime || "", slot.endTime || "", booking.start_time, booking.end_time);
    });

    if (hasOverlap) {
      console.log("[checkout/create] service availability rejection", {
        businessId: safeBusinessId,
        serviceId: selectedService?.id || null,
        date: slot.date || null,
        startTime: slot.startTime || null,
        endTime: slot.endTime || null,
        reason: "overlap",
      });
      return errorResponse({
        status: 409,
        error: "That time slot is no longer available.",
        code: "CHECKOUT_SERVICE_SLOT_UNAVAILABLE",
        step: "service.availability",
      });
    }

    const recentStart = new Date(slot.date || "");
    recentStart.setDate(recentStart.getDate() - 30);
    const recentStartStr = recentStart.toISOString().slice(0, 10);

    const recentBookingsResult = (await applyVisibleFilter(
      (supabaseAdmin
        .from("bookings")
        .select("date, start_time, end_time, created_at, status")
        .eq("business_id", safeBusinessId)
        .gte("date", recentStartStr)
        .lte("date", slot.date)) as any
    )) as { data: SlotBookingRow[] | null };
    const recentBookings = (recentBookingsResult.data || []).filter((booking) =>
      isBlockingServiceBookingStatus(booking.status)
    );

    const { data: pricingRules } = await supabaseAdmin
      .from("pricing_rules")
      .select(
        "id, business_id, service_id, day_of_week, start_time, end_time, active, priority, rule_type, amount, percentage, metadata, created_at, updated_at"
      )
      .eq("business_id", safeBusinessId)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .order("priority", { ascending: false });

    const servicePricingRules = (pricingRules || []) as PricingRule[];

    const demandScore = calculateDemandScore({
      slot: bookingSlot,
      allBookings: bookingsForPricing,
      recentBookings: ((recentBookings || []) as SlotBookingRow[]).filter((booking) => {
        if (!booking.created_at) return false;
        const created = new Date(booking.created_at);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);
        return created >= cutoff;
      }),
    });

    const gapDiscount = shouldApplyGapDiscount({
      slot: bookingSlot,
      bookingsForDate: bookingsForPricing,
    });

    const pricing = calculateSlotPrice({
      slot: bookingSlot,
      demandScore,
      gapDiscount,
      basePrice:
        Number.isFinite(Number(selectedService?.price)) && Number(selectedService?.price) > 0
          ? Number(selectedService?.price)
          : 0,
      pricingRules: servicePricingRules,
      serviceId: selectedService?.id || null,
      dayOfWeek: new Date(`${slot.date}T12:00:00`).getDay(),
    });

    const selectedServiceTotal = selectedServices.reduce(
      (sum, service) => sum + Number(service.price || 0),
      0
    );
    const price = selectedServiceTotal;
    const priceAdjustment = 0;
    const currency = "usd";
    const baseServicePrice = selectedServiceTotal;
    const computedStripeAmount = normalizeUsdAmountToCents(price);
    const subtotalCents = computedStripeAmount;
    const amountTax = 0;
    const discountValidation = payload.promoCode
      ? await validateDiscountForCheckout({
          supabaseAdmin,
          businessId: safeBusinessId,
          code: payload.promoCode,
          checkoutType: "service",
          subtotalCents,
        })
      : null;
    if (discountValidation && !discountValidation.ok) {
      return errorResponse({
        status: 400,
        error: discountValidation.error,
        code: discountValidation.code,
        step: "discount.validate",
      });
    }
    const appliedDiscount =
      discountValidation && discountValidation.ok ? discountValidation.discount : null;
    const totalBeforeTaxCents = appliedDiscount?.finalTotalCents ?? subtotalCents;
    const totalCents = totalBeforeTaxCents + amountTax;
    if (!Number.isFinite(totalCents) || totalCents <= 0) {
      return errorResponse({
        status: 400,
        error: "Promo code reduces the payable total below the minimum supported amount.",
        code: "CHECKOUT_SERVICE_TOTAL_DISCOUNT_INVALID",
        step: "discount.validate",
      });
    }
    const applicationFee = calculatePlatformFeeCents(totalCents, feeBasisPoints);
    const netToBusinessCents = getNetPayoutCents(totalCents, applicationFee);
    const requestFingerprint = buildCheckoutRequestFingerprint({
      kind: "booking",
      flowType: "service_booking",
      businessId: safeBusinessId,
      serviceIds: selectedServices.map((service) => service.id),
      date: slot.date || null,
      startTime: slot.startTime || null,
      endTime: slot.endTime || null,
      serviceMode: serviceMode || null,
      customerName,
      customerEmail,
      customerPhone,
      address: addressInput,
      notes: payload.notes || "",
      promoCode: appliedDiscount?.code || payload.promoCode || null,
    });

    logCheckoutStage("amounts_resolved", {
      branch: "service_booking",
      businessId: safeBusinessId,
      serviceId: selectedService?.id || null,
      serviceIds: selectedServices.map((service) => service.id),
      subtotal: subtotalCents,
      tax: amountTax,
      total: totalCents,
      discountAmountCents: appliedDiscount?.discountAmountCents ?? 0,
    });
    logCheckoutStage("fee_resolved", {
      branch: "service_booking",
      businessId: safeBusinessId,
      serviceId: selectedService?.id || null,
      serviceIds: selectedServices.map((service) => service.id),
      feePercent,
      applicationFeeCents: applicationFee,
      netToBusinessCents,
    });
    console.log("[checkout/create] pricing rules:", {
      businessId: safeBusinessId,
      serviceId: selectedService?.id || null,
      matchedRuleCount: pricing.matchedRuleCount,
      appliedAmountAdjustment: pricing.appliedAmountAdjustment,
      appliedPercentageAdjustment: pricing.appliedPercentageAdjustment,
      fallbackPricingUsed: pricing.fallbackUsed,
    });
    console.log("[checkout/create] checkout payload selection", {
      businessId: safeBusinessId,
      selectionType: "service",
      selectedIds: selectedServices.map((service) => service.id),
      pricingAdjustmentApplied: priceAdjustment !== 0,
      baseServicePrice,
      finalTotalCents: totalCents,
      discountAmountCents: appliedDiscount?.discountAmountCents ?? 0,
    });
    console.log("[checkout/create] stripe amount audit", {
      businessId: safeBusinessId,
      serviceId: selectedService?.id || null,
      serviceIds: selectedServices.map((service) => service.id),
      rawServicePriceFromDb: baseServicePrice,
      computedStripeAmount: price,
      currency,
      finalUnitAmount: totalCents,
    });
    console.log("[checkout/create] service fulfillment snapshot:", {
      businessId: safeBusinessId,
      serviceId: selectedService?.id || null,
      serviceIds: selectedServices.map((service) => service.id),
      serviceName: selectedService?.name || null,
      serviceNames: selectedServices.map((service) => service.name || "Service"),
      date: slot.date || null,
      startTime: slot.startTime || null,
      endTime: slot.endTime || null,
      serviceMode: serviceMode || null,
      hasAddress: hasServiceAddress,
      hasNotes: hasServiceNotes,
    });

    try {
      await trackLeadEventServer({
        businessId: safeBusinessId,
        eventType: "booking_started",
        source: `public:${business.business_type || "service"}`,
        visitor_name: customerName,
        visitor_email: customerEmail || null,
        visitor_phone: customerPhone,
        metadata: {
          intentType,
          serviceId: selectedService?.id || null,
          serviceIds: selectedServices.map((service) => service.id),
          serviceName: selectedService?.name || null,
          serviceNames: selectedServices.map((service) => service.name || "Service"),
          serviceMode,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          totalCents,
          discountAmountCents: appliedDiscount?.discountAmountCents ?? 0,
        },
      });
    } catch (leadError) {
      console.error("[checkout/create] lead tracking failed:", leadError);
    }

    const intentInsertPayload: CheckoutIntentInsertPayload = {
      business_id: safeBusinessId,
      kind: "booking",
      status: "pending",
      customer_name: customerName,
      customer_email: customerEmail,
      phone: customerPhone,
      currency: "usd",
      address_json: addressInput,
      order_items: null,
      metadata: {
        intent_type: "booking",
        flow_type: "service_booking",
        business_type: business.business_type,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        service_id: selectedService?.id || null,
        service_ids: selectedServices.map((service) => service.id),
        service_name: selectedService?.name || null,
        service_names: selectedServices.map((service) => service.name || "Service"),
        service_price: selectedService?.price || null,
        service_total_price: selectedServiceTotal,
        phone: customerPhone,
        fulfillment_type: serviceMode,
        item_count: selectedServices.length,
        has_service_address: hasServiceAddress,
        amount_subtotal: subtotalCents,
        amount_tax: amountTax,
        amount_total: totalCents,
        discount: serializeAppliedDiscount(appliedDiscount),
        discount_code: appliedDiscount?.code || null,
        discount_amount_cents: appliedDiscount?.discountAmountCents ?? 0,
        plan: normalizedPlan,
        platform_fee_percent: feePercent,
        platform_fee_bps: feeBasisPoints,
        platform_fee_source: platformFee.source,
        application_fee_cents: applicationFee,
        net_to_business_cents: netToBusinessCents,
        request_fingerprint: requestFingerprint,
        notes: payload.notes || "",
        date: slot.date,
        start_time: slot.startTime,
        end_time: slot.endTime,
        demand_score: demandScore,
        price_adjustment: priceAdjustment,
        service_mode: serviceMode,
        checkout_type: payload.universalType || "service",
        requested_price: payload.universalPrice,
        checkout_metadata: payload.universalMetadata || null,
      },
      amount_subtotal: subtotalCents,
      amount_tax: amountTax,
      amount_total: totalCents,
      service_id: selectedService?.id || null,
      booking_id: null,
      product_id: null,
      rental_id: null,
      property_id: null,
      stripe_checkout_session_id: null,
      stripe_payment_intent_id: null,
      expires_at: null,
      paid_at: null,
    };

    let intentId: string | null = null;
    const existingIntent = await findMatchingPendingCheckoutIntent({
      supabaseAdmin,
      businessId: safeBusinessId,
      kind: "booking",
      requestFingerprint,
      amountTotal: totalCents,
    });
    const reusableSession = await maybeReuseOpenCheckoutSession({
      checkoutIntent: existingIntent,
      baseUrl,
    });

    if (reusableSession) {
      logCheckoutStage("checkout_reused", {
        branch: "service_booking",
        businessId: safeBusinessId,
        serviceId: selectedService?.id || null,
        checkoutIntentId: existingIntent?.id || null,
        sessionId: reusableSession.sessionId,
      });
      return NextResponse.json({
        url: reusableSession.url,
        sessionId: reusableSession.sessionId,
        reused: true,
      });
    }

    if (existingIntent?.id && !existingIntent.stripe_checkout_session_id) {
      intentId = existingIntent.id;
    } else {
      logCheckoutStage("db_write_start", {
        branch: "service_booking",
        target: "checkout_intents",
        action: "insert",
        businessId: safeBusinessId,
        serviceId: selectedService?.id || null,
        amountTotal: totalCents,
      });

      const intentInsert = await insertCheckoutIntentSafely({
        supabaseAdmin,
        payload: intentInsertPayload,
        context: {
          businessId: safeBusinessId,
          intentType: "booking",
          flowType: "service_booking",
          businessType: business.business_type || null,
        },
      });

      intentId = intentInsert.id;
      logCheckoutStage("db_write_success", {
        branch: "service_booking",
        target: "checkout_intents",
        action: "insert",
        checkoutIntentId: intentId,
        degraded: intentInsert.degraded,
        removedColumns: intentInsert.removedColumns,
      });
    }

    logCheckoutStage("stripe_session_create_start", {
      branch: "service_booking",
      businessId: safeBusinessId,
      serviceId: selectedService?.id || null,
      amountTotal: totalCents,
    });
    step = "stripe.session.create";
    const bookingSessionMetadata = {
      kind: "checkout_intent",
      intent_type: "booking",
      checkout_intent_id: intentId || "",
      flow_type: "service_booking",
      business_id: safeBusinessId,
      business_type: business.business_type || "",
      service_id: selectedService?.id || "",
      service_ids: JSON.stringify(selectedServices.map((service) => service.id)),
      service_name: selectedService?.name || "",
      service_names: JSON.stringify(selectedServices.map((service) => service.name || "Service")),
      date: slot.date || "",
      start_time: slot.startTime || "",
      end_time: slot.endTime || "",
      guest_name: customerName,
      guest_email: customerEmail,
      guest_phone: customerPhone,
      service_mode: serviceMode || "",
      address_json: JSON.stringify(addressInput),
      notes: payload.notes || "",
      amount_subtotal: String(subtotalCents),
      amount_total: String(totalCents),
      discount_code_id: appliedDiscount?.id || "",
      discount_code: appliedDiscount?.code || "",
      discount_amount_cents: String(appliedDiscount?.discountAmountCents ?? 0),
      discount_type: appliedDiscount?.discountType || "",
      discount_value: appliedDiscount ? String(appliedDiscount.discountValue) : "",
      discount_applies_to: appliedDiscount?.appliesTo || "",
      platform_fee: String(applicationFee),
      platform_fee_percent: String(feePercent),
      platform_fee_bps: String(feeBasisPoints),
      platform_fee_source: platformFee.source,
      net_to_business_cents: String(netToBusinessCents),
      request_fingerprint: requestFingerprint,
      checkout_type: payload.universalType || "service",
      requested_price: payload.universalPrice ? String(payload.universalPrice) : "",
      checkout_metadata: JSON.stringify(payload.universalMetadata || {}),
    };
    const session =
      verificationMode
        ? buildVerificationSession({
            intentId,
            businessType: business.business_type,
            metadata: bookingSessionMetadata,
            totalCents,
            customerEmail,
            baseUrl,
            mode: verificationMode,
          })
        : await stripe.checkout.sessions.create({
            mode: "payment",
            customer_email: customerEmail,
            payment_method_types: ["card"],
            line_items: [
              {
                quantity: 1,
                price_data: {
                  currency,
                  unit_amount: totalCents,
                  product_data: {
                    name: `${selectedServices.map((service) => service.name || "Service").join(", ") || business.name || "Booking"} - ${slot.date}`,
                    description: `${slot.startTime} - ${slot.endTime}`,
                  },
                },
              },
            ],
            success_url: `${baseUrl}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: getPublicCancelUrl({
              baseUrl,
              businessType: business.business_type,
              slug: business.slug,
            }),
            payment_intent_data: {
              application_fee_amount: applicationFee,
              transfer_data: {
                destination: business.stripe_account_id,
              },
            },
            metadata: bookingSessionMetadata,
          }, {
            idempotencyKey: `checkout:${intentId || requestFingerprint}`,
          });
    logCheckoutStage("stripe_session_create_success", {
      branch: "service_booking",
      businessId: safeBusinessId,
      serviceId: selectedService?.id || null,
      serviceIds: selectedServices.map((service) => service.id),
      sessionId: session.id,
    });

    if (intentId) {
      const sessionUpdateResult = await updateCheckoutIntentSafely({
        supabaseAdmin,
        intentId,
        payload: {
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id:
            typeof session.payment_intent === "string" ? session.payment_intent : null,
        },
        context: {
          businessId: safeBusinessId,
          intentType: "booking",
          flowType: "service_booking",
          businessType: business.business_type || null,
          sessionId: session.id,
        },
      });

      if (!sessionUpdateResult.ok) {
        console.warn("[checkout/create] checkout intent session link degraded", {
          businessId: safeBusinessId,
          intentType: "booking",
          flowType: "service_booking",
          checkoutIntentId: intentId,
          sessionId: session.id,
          removedColumns: sessionUpdateResult.removedColumns,
          message: sessionUpdateResult.message,
        });
      }
    }

    logCheckoutStage("checkout_ready", {
      branch: "service_booking",
      businessId: safeBusinessId,
      serviceId: selectedService?.id || null,
      sessionId: session.id,
    });

    await maybeFinalizeVerificationSession({
      mode: verificationMode || "draft",
      session,
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (error: unknown) {
    const err = error as StripeLikeError;
    const debug = {
      name: err?.name || "Error",
      message: err?.message || "Unknown error",
      code: err?.code,
      type: err?.type,
      statusCode: err?.statusCode,
    };

    logRouteError("checkout/create", {
      step,
      code: "CHECKOUT_CREATE_FAILED",
      message: getErrorMessage(error, "Checkout failed"),
      status: 500,
      error,
      extra: {
        debug: isDev ? debug : undefined,
      },
    });

    return errorResponse({
      status: 500,
      error: "We couldn't start checkout right now.",
      code: "CHECKOUT_CREATE_FAILED",
      step,
      extra: isDev ? { debug } : undefined,
    });
  }
}
