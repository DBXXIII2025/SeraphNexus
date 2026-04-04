import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/appUrl";
import { stripe } from "@/lib/stripe";
import { fetchCatalogItemsByIds } from "@/lib/catalog";
import {
  calculateDemandScore,
  calculateSlotPrice,
  shouldApplyGapDiscount,
  type PricingRule,
} from "@/lib/pricing/engine";
import {
  getNetPayoutCents,
  getPlatformFeePercent,
  normalizeBusinessPlan,
} from "@/lib/planConfig";
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
import { trackLeadEventServer } from "@/lib/leads.server";
import { errorResponse, getErrorMessage, logRouteError } from "@/lib/apiErrors";
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
};

type CheckoutPayload = {
  intentType?: "order" | "booking";
  businessId?: string;
  businessType?: string;
  propertyId?: string;
  serviceId?: string;
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
  duration: number | null;
  price: number | null;
  business_id: string;
};

type BookingInsertRow = Database["public"]["Tables"]["bookings"]["Insert"];

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
        };
      })
    : [];
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

function toBookingPlatformFeeValue(applicationFeeCents: number) {
  return Math.max(0, Math.round(applicationFeeCents / 100));
}

export async function POST(req: Request) {
  const isDev = process.env.NODE_ENV !== "production";
  let step = "request.parse";

  try {
    const payload = (await req.json()) as CheckoutPayload;
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
        "id, name, slug, stripe_account_id, stripe_charges_enabled, plan, business_type"
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

    const normalizedPlan = normalizeBusinessPlan(business.plan);
    const feePercent = getPlatformFeePercent(normalizedPlan);
    logCheckoutStage("business_resolved", {
      businessId: safeBusinessId,
      businessType: business.business_type || null,
      plan: normalizedPlan,
      stripeChargesEnabled: business.stripe_charges_enabled,
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
      const totalCents = subtotalCents + amountTax;

      logCheckoutStage("amounts_resolved", {
        branch: orderFlowType,
        businessId: safeBusinessId,
        lineItemCount: pricedOrderItems.length,
        subtotal: subtotalCents,
        tax: amountTax,
        total: totalCents,
      });

      if (!Number.isFinite(subtotalCents) || subtotalCents <= 0) {
        return errorResponse({
          status: 400,
          error: "We couldn't calculate a valid order total.",
          code: "CHECKOUT_ORDER_TOTAL_INVALID",
          step: "amount.validate",
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

      const applicationFee = Math.round(totalCents * feePercent);
      const netToBusinessCents = getNetPayoutCents(totalCents, applicationFee);
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
          item_count: pricedOrderItems.length,
          fulfillment_type: fulfillmentType,
          has_delivery_address: hasDeliveryAddress,
          amount_subtotal: subtotalCents,
          amount_tax: amountTax,
          amount_total: totalCents,
          plan: normalizedPlan,
          platform_fee_percent: feePercent,
          application_fee_cents: applicationFee,
          net_to_business_cents: netToBusinessCents,
          notes: payload.notes || "",
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

      logCheckoutStage("db_write_success", {
        branch: orderFlowType,
        target: "checkout_intents",
        action: "insert",
        checkoutIntentId: intentInsert.id,
        degraded: intentInsert.degraded,
        removedColumns: intentInsert.removedColumns,
      });

      logCheckoutStage("stripe_session_create_start", {
        branch: orderFlowType,
        businessId: safeBusinessId,
        amountTotal: totalCents,
        lineItemCount: pricedOrderItems.length,
      });
      step = "stripe.session.create";
      const orderSuccessUrl = intentInsert.id
        ? `${baseUrl}/order/success?session_id={CHECKOUT_SESSION_ID}&order_ref=${intentInsert.id}`
        : `${baseUrl}/order/success?session_id={CHECKOUT_SESSION_ID}`;
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: customerEmail || undefined,
        payment_method_types: ["card"],
        line_items: pricedOrderItems.map((item) => ({
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
        metadata: {
          kind: "checkout_intent",
          intent_type: "order",
          flow_type: orderFlowType,
          checkout_intent_id: intentInsert.id || "",
          business_id: safeBusinessId,
          business_type: business.business_type || "",
          customer_name: customerName,
          customer_email: customerEmail || "",
          customer_phone: customerPhone,
          fulfillment_type: fulfillmentType,
          order_items: JSON.stringify(pricedOrderItems),
          address_json: JSON.stringify(addressInput),
          notes: payload.notes || "",
          amount_total: String(totalCents),
          platform_fee: String(applicationFee),
        },
      });
      logCheckoutStage("stripe_session_create_success", {
        branch: orderFlowType,
        businessId: safeBusinessId,
        sessionId: session.id,
      });

      if (intentInsert.id) {
        const sessionUpdateResult = await updateCheckoutIntentSafely({
          supabaseAdmin,
          intentId: intentInsert.id,
          payload: { stripe_checkout_session_id: session.id },
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
            checkoutIntentId: intentInsert.id,
            sessionId: session.id,
            removedColumns: sessionUpdateResult.removedColumns,
            message: sessionUpdateResult.message,
          });
        }
      }

      logCheckoutStage("checkout_ready", {
        branch: orderFlowType,
        businessId: safeBusinessId,
        checkoutIntentId: intentInsert.id,
        sessionId: session.id,
        itemCount: pricedOrderItems.length,
        totalCents,
      });

      return NextResponse.json({ url: session.url, sessionId: session.id });
    }

    const serviceMode = payload.serviceMode;
    const isRentalBusiness = isRentalBusinessType(business.business_type);
    const serviceId = payload.serviceId?.trim() || "";
    logCheckoutStage("branch_selected", {
      branch: isRentalBusiness ? "rental_reservation" : "service_booking",
      businessId: safeBusinessId,
      businessType: business.business_type || null,
      propertyId: payload.propertyId || null,
      serviceId: serviceId || null,
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
    if (!isRentalBusiness) {
      if (!serviceId) {
        return errorResponse({
          status: 400,
          error: "Select a service before booking.",
          code: "CHECKOUT_SERVICE_REQUIRED",
          step: "service.validate",
        });
      }

      const { data: service } = await supabaseAdmin
        .from("services")
        .select("id, name, duration, price, business_id")
        .eq("id", serviceId)
        .eq("business_id", safeBusinessId)
        .maybeSingle();

      if (!service?.id) {
        console.log("[checkout/create] rejected invalid service selection", {
          businessId: safeBusinessId,
          serviceId,
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

      selectedService = service as ServiceRow;
      console.log("[checkout/create] service selection source", {
        businessId: safeBusinessId,
        selectionSource: "services",
        serviceId: selectedService.id,
        serviceName: selectedService.name || null,
        serviceBasePrice: selectedService.price || null,
        serviceDuration: selectedService.duration || null,
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
          supabaseAdmin
            .from("rental_reservations")
            .select("id, status, payment_status, check_in_date, check_out_date")
            .eq("business_id", safeBusinessId)
            .eq("property_id", propertyId)
            .order("check_in_date", { ascending: true }),
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
      const totalCents = subtotalCents + amountTax;
      const applicationFee = Math.round(totalCents * feePercent);
      const netToBusinessCents = getNetPayoutCents(totalCents, applicationFee);

      logCheckoutStage("amounts_resolved", {
        branch: "rental_reservation",
        businessId: safeBusinessId,
        propertyId,
        subtotal: subtotalCents,
        tax: amountTax,
        total: totalCents,
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
          plan: normalizedPlan,
          platform_fee_percent: feePercent,
          application_fee_cents: applicationFee,
          net_to_business_cents: netToBusinessCents,
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

      logCheckoutStage("db_write_success", {
        branch: "rental_reservation",
        target: "checkout_intents",
        action: "insert",
        checkoutIntentId: intentInsert.id,
        degraded: intentInsert.degraded,
        removedColumns: intentInsert.removedColumns,
      });

      const rentalSessionMetadata = {
        kind: "checkout_intent",
        intent_type: "booking",
        reservation_type: "rental",
        flow_type: "rental_reservation",
        checkout_intent_id: intentInsert.id || "",
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
        amount_total: String(totalCents),
        platform_fee: String(applicationFee),
      };
      logCheckoutStage("stripe_session_create_start", {
        branch: "rental_reservation",
        businessId: safeBusinessId,
        propertyId,
        amountTotal: totalCents,
      });

      step = "stripe.session.create";
      const session = await stripe.checkout.sessions.create({
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
      });
      logCheckoutStage("stripe_session_create_success", {
        branch: "rental_reservation",
        businessId: safeBusinessId,
        propertyId,
        sessionId: session.id,
      });

      if (intentInsert.id) {
        const sessionUpdateResult = await updateCheckoutIntentSafely({
          supabaseAdmin,
          intentId: intentInsert.id,
          payload: { stripe_checkout_session_id: session.id },
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
            checkoutIntentId: intentInsert.id,
            sessionId: session.id,
            removedColumns: sessionUpdateResult.removedColumns,
            message: sessionUpdateResult.message,
          });
        }
      }

      return NextResponse.json({ url: session.url, sessionId: session.id });
    }

    const { data: bookings } = await supabaseAdmin
      .from("bookings")
      .select("start_time, end_time, status")
      .eq("business_id", safeBusinessId)
      .eq("date", slot.date)
      .neq("status", "cancelled");

    const bookingSlot = {
      date: slot.date,
      start: slot.startTime,
      end: slot.endTime,
    } as {
      date: string;
      start: string;
      end: string;
    };

    const bookingRows = (bookings || []) as SlotBookingRow[];

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

    const { data: recentBookings } = await supabaseAdmin
      .from("bookings")
      .select("date, start_time, end_time, created_at, status")
      .eq("business_id", safeBusinessId)
      .gte("date", recentStartStr)
      .lte("date", slot.date)
      .neq("status", "cancelled");

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
          : 100,
      pricingRules: servicePricingRules,
      serviceId: selectedService?.id || null,
      dayOfWeek: new Date(`${slot.date}T12:00:00`).getDay(),
    });

    const price = pricing.price;
    const priceAdjustment = pricing.priceAdjustment;
    const subtotalCents = Math.round(price * 100);
    const amountTax = 0;
    const totalCents = subtotalCents + amountTax;
    const applicationFee = Math.round(totalCents * feePercent);
    const netToBusinessCents = getNetPayoutCents(totalCents, applicationFee);

    logCheckoutStage("amounts_resolved", {
      branch: "service_booking",
      businessId: safeBusinessId,
      serviceId: selectedService?.id || null,
      subtotal: subtotalCents,
      tax: amountTax,
      total: totalCents,
    });
    logCheckoutStage("fee_resolved", {
      branch: "service_booking",
      businessId: safeBusinessId,
      serviceId: selectedService?.id || null,
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
      selectedIds: selectedService?.id ? [selectedService.id] : [],
      pricingAdjustmentApplied: priceAdjustment !== 0,
      baseServicePrice:
        Number.isFinite(Number(selectedService?.price)) && Number(selectedService?.price) > 0
          ? Number(selectedService?.price)
          : null,
      finalTotalCents: totalCents,
    });
    console.log("[checkout/create] service fulfillment snapshot:", {
      businessId: safeBusinessId,
      serviceId: selectedService?.id || null,
      serviceName: selectedService?.name || null,
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
          serviceName: selectedService?.name || null,
          serviceMode,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          totalCents,
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
        business_type: business.business_type,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        service_id: selectedService?.id || null,
        service_name: selectedService?.name || null,
        service_duration: selectedService?.duration || null,
        service_price: selectedService?.price || null,
        phone: customerPhone,
        fulfillment_type: serviceMode,
        item_count: 1,
        has_service_address: hasServiceAddress,
        amount_subtotal: subtotalCents,
        amount_tax: amountTax,
        amount_total: totalCents,
        plan: normalizedPlan,
        platform_fee_percent: feePercent,
        application_fee_cents: applicationFee,
        net_to_business_cents: netToBusinessCents,
        notes: payload.notes || "",
        date: slot.date,
        start_time: slot.startTime,
        end_time: slot.endTime,
        demand_score: demandScore,
        price_adjustment: priceAdjustment,
        service_mode: serviceMode,
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

    logCheckoutStage("db_write_success", {
      branch: "service_booking",
      target: "checkout_intents",
      action: "insert",
      checkoutIntentId: intentInsert.id,
      degraded: intentInsert.degraded,
      removedColumns: intentInsert.removedColumns,
    });

    const bookingPlatformFee = toBookingPlatformFeeValue(applicationFee);
    step = "booking.insert_pending";
    const pendingBookingPayload: BookingInsertRow = {
      business_id: safeBusinessId,
      guest_name: customerName,
      guest_email: customerEmail,
      guest_phone: customerPhone,
      reminder_sent: false,
      date: slot.date || null,
      start_time: slot.startTime || null,
      end_time: slot.endTime || null,
      booking_time: `${slot.date || ""}T${slot.startTime || "00:00"}:00`,
      duration_minutes:
        selectedService?.duration ||
        (() => {
          const [startHour, startMinute] = String(slot.startTime || "00:00")
            .split(":")
            .map((value) => Number(value));
          const [endHour, endMinute] = String(slot.endTime || "00:00")
            .split(":")
            .map((value) => Number(value));
          const minutes =
            endHour * 60 + (endMinute || 0) - (startHour * 60 + (startMinute || 0));
          return minutes > 0 ? minutes : null;
        })(),
      status: "pending",
      payment_status: "pending",
      customer_email: customerEmail,
      customer_name: customerName,
      phone: customerPhone,
      client_address:
        serviceMode === "onsite"
          ? [
              addressInput.line1,
              addressInput.line2,
              addressInput.city,
              addressInput.state,
              addressInput.postalCode,
            ]
              .filter(Boolean)
              .join(", ")
          : null,
      amount_total: totalCents,
      total_amount: totalCents,
      platform_fee: bookingPlatformFee,
      metadata: {
        service_id: selectedService?.id || null,
        service_name: selectedService?.name || null,
        service_mode: serviceMode || null,
        checkout_intent_id: intentInsert.id || null,
        application_fee_cents: applicationFee,
      },
    };

    logCheckoutStage("db_write_start", {
      branch: "service_booking",
      target: "bookings",
      action: "insert_pending",
      businessId: safeBusinessId,
      serviceId: selectedService?.id || null,
      amountTotal: totalCents,
      applicationFeeCents: applicationFee,
      persistedBookingPlatformFee: bookingPlatformFee,
    });
    const { data: pendingBooking, error: pendingBookingError } = await supabaseAdmin
      .from("bookings")
      .insert(pendingBookingPayload)
      .select("id")
      .maybeSingle();

    if (pendingBookingError || !pendingBooking?.id) {
      logCheckoutStage("db_write_error", {
        branch: "service_booking",
        target: "bookings",
        action: "insert_pending",
        businessId: safeBusinessId,
        serviceId: selectedService?.id || null,
        message: pendingBookingError?.message || "Failed to create pending booking",
        applicationFeeCents: applicationFee,
        persistedBookingPlatformFee: bookingPlatformFee,
      });
      throw new Error(
        pendingBookingError?.message || "Failed to create pending booking"
      );
    }

    logCheckoutStage("db_write_success", {
      branch: "service_booking",
      target: "bookings",
      action: "insert_pending",
      businessId: safeBusinessId,
      serviceId: selectedService?.id || null,
      bookingId: pendingBooking.id,
      amountTotal: totalCents,
    });

    logCheckoutStage("stripe_session_create_start", {
      branch: "service_booking",
      businessId: safeBusinessId,
      serviceId: selectedService?.id || null,
      bookingId: pendingBooking.id,
      amountTotal: totalCents,
    });
    step = "stripe.session.create";
    const session = await stripe.checkout.sessions.create({
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
              name: `${selectedService?.name || business.name || "Booking"} - ${slot.date}`,
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
      metadata: {
        kind: "checkout_intent",
        intent_type: "booking",
        checkout_intent_id: intentInsert.id || "",
        booking_id: pendingBooking.id,
        flow_type: "service_booking",
        business_id: safeBusinessId,
        business_type: business.business_type || "",
        service_id: selectedService?.id || "",
        service_name: selectedService?.name || "",
        date: slot.date || "",
        start_time: slot.startTime || "",
        end_time: slot.endTime || "",
        guest_name: customerName,
        guest_email: customerEmail,
        guest_phone: customerPhone,
        service_mode: serviceMode || "",
        address_json: JSON.stringify(addressInput),
        notes: payload.notes || "",
        amount_total: String(totalCents),
        platform_fee: String(applicationFee),
      },
    });
    logCheckoutStage("stripe_session_create_success", {
      branch: "service_booking",
      businessId: safeBusinessId,
      serviceId: selectedService?.id || null,
      bookingId: pendingBooking.id,
      sessionId: session.id,
    });

    if (intentInsert.id) {
      const sessionUpdateResult = await updateCheckoutIntentSafely({
        supabaseAdmin,
        intentId: intentInsert.id,
        payload: {
          stripe_checkout_session_id: session.id,
          booking_id: pendingBooking.id,
          metadata: {
            ...intentInsertPayload.metadata,
            booking_id: pendingBooking.id,
          },
        },
        context: {
          businessId: safeBusinessId,
          intentType: "booking",
          flowType: "service_booking",
          businessType: business.business_type || null,
          bookingId: pendingBooking.id,
          sessionId: session.id,
        },
      });

      if (!sessionUpdateResult.ok) {
        console.warn("[checkout/create] checkout intent session link degraded", {
          businessId: safeBusinessId,
          intentType: "booking",
          flowType: "service_booking",
          checkoutIntentId: intentInsert.id,
          bookingId: pendingBooking.id,
          sessionId: session.id,
          removedColumns: sessionUpdateResult.removedColumns,
          message: sessionUpdateResult.message,
        });
      }
    }

    const { error: bookingSessionUpdateError } = await supabaseAdmin
      .from("bookings")
      .update({
        stripe_session_id: session.id,
      })
      .eq("id", pendingBooking.id);

    if (bookingSessionUpdateError) {
      step = "booking.update_session";
      throw new Error(
        bookingSessionUpdateError.message ||
          "Failed to attach Stripe checkout session to booking"
      );
    }

    logCheckoutStage("checkout_ready", {
      branch: "service_booking",
      businessId: safeBusinessId,
      serviceId: selectedService?.id || null,
      bookingId: pendingBooking.id,
      sessionId: session.id,
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
