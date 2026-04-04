import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/emailProvider";
import { getPlatformSettings } from "@/lib/platformSettings";
import {
  asArray,
  asNumber,
  asRecord,
  asString,
  compactCustomerSummary,
  formatAddress,
  formatCurrency,
  formatDateLabel,
  formatTimeLabel,
  titleCaseStatus,
} from "@/lib/transactionConfirmation";

type JsonRecord = Record<string, unknown>;

type EmailFlowType =
  | "service_booking"
  | "rental_reservation"
  | "food_order"
  | "store_order";

type EmailSourceTable = "orders" | "bookings" | "rental_reservations";

type EmailIntent = {
  id: string;
  raw: JsonRecord;
  metadata: JsonRecord;
  customerEmail: string | null;
  customerName: string | null;
  phone: string | null;
  fulfillmentType: string | null;
  address: JsonRecord;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    source: string | null;
  }>;
  flowType: EmailFlowType | null;
  businessId: string | null;
};

type EmailWriteResult = {
  sourceTable: EmailSourceTable;
  recordId: string;
  recordAction: "created" | "updated" | "none";
  duplicateRetryHandled: boolean;
  confirmationEmailEligible: boolean;
};

type EmailContext = {
  source: string;
  sessionId: string;
  paymentIntentId: string | null;
  checkoutIntentId: string | null;
  flowType: EmailFlowType | null;
  businessType: string | null;
  sourceTable: EmailSourceTable | null;
};

type DetailItem = {
  label: string;
  value: string;
};

type DetailSection = {
  title: string;
  items: DetailItem[];
};

type EmailContent = {
  subject: string;
  preview: string;
  headline: string;
  intro: string;
  sections: DetailSection[];
};

const supabaseAdmin = createAdminClient();

function logEmail(stage: string, context: EmailContext, extra?: Record<string, unknown>) {
  console.log("[transaction/email]", {
    stage,
    ...context,
    ...(extra || {}),
  });
}

function logEmailError(
  stage: string,
  context: EmailContext,
  error: unknown,
  extra?: Record<string, unknown>
) {
  console.error("[transaction/email]", {
    stage,
    ...context,
    ...(extra || {}),
    message: error instanceof Error ? error.message : "Unknown email error",
    stack: error instanceof Error ? error.stack || null : null,
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getSafeMetadata(metadata: JsonRecord) {
  return Object.entries(metadata).reduce<JsonRecord>((safe, [key, value]) => {
    if (value !== undefined) {
      safe[key] = value;
    }
    return safe;
  }, {});
}

function wasConfirmationEmailSent(intent: EmailIntent) {
  return Boolean(asString(intent.metadata.confirmation_email_sent_at));
}

async function markConfirmationEmailSent(intent: EmailIntent, writeResult: EmailWriteResult) {
  if (intent.id.startsWith("session:")) {
    return;
  }

  const rawKeys = Object.keys(intent.raw);
  const payload: JsonRecord = {};
  const nextMetadata = getSafeMetadata({
    ...intent.metadata,
    confirmation_email_sent_at: new Date().toISOString(),
    confirmation_email_record_id: writeResult.recordId,
    confirmation_email_flow: intent.flowType,
  });

  if (rawKeys.includes("metadata")) {
    payload.metadata = nextMetadata;
  } else if (rawKeys.includes("meta_json")) {
    payload.meta_json = nextMetadata;
  } else {
    return;
  }

  const { error } = await supabaseAdmin
    .from("checkout_intents")
    .update(payload)
    .eq("id", intent.id);

  if (error) {
    throw new Error(error.message);
  }
}

function renderText(content: EmailContent, brandName: string) {
  const lines: string[] = [
    `${brandName}`,
    "",
    content.headline,
    "",
    content.intro,
  ];

  for (const section of content.sections) {
    if (section.items.length === 0) {
      continue;
    }

    lines.push("");
    lines.push(section.title.toUpperCase());
    for (const item of section.items) {
      lines.push(`${item.label}: ${item.value}`);
    }
  }

  return lines.join("\n");
}

function renderHtml(content: EmailContent, brandName: string, supportEmail: string) {
  const sections = content.sections
    .filter((section) => section.items.length > 0)
    .map((section) => {
      const items = section.items
        .map(
          (item) => `
            <tr>
              <td style="padding:0 18px 12px 0;color:#857f79;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;vertical-align:top;">
                ${escapeHtml(item.label)}
              </td>
              <td style="padding:0 0 12px;color:#f6f1eb;font-size:14px;line-height:1.6;vertical-align:top;">
                ${escapeHtml(item.value)}
              </td>
            </tr>
          `
        )
        .join("");

      return `
        <div style="margin-top:18px;border:1px solid rgba(255,255,255,0.08);border-radius:20px;background:#171414;padding:22px;">
          <p style="margin:0 0 16px;color:#b8b0aa;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">
            ${escapeHtml(section.title)}
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${items}
          </table>
        </div>
      `;
    })
    .join("");

  return `
    <div style="margin:0;padding:32px 0;background:#0d0a0a;font-family:Georgia, 'Times New Roman', serif;color:#f6f1eb;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
        ${escapeHtml(content.preview)}
      </div>
      <div style="max-width:680px;margin:0 auto;padding:0 18px;">
        <div style="border:1px solid rgba(212,175,55,0.18);border-radius:28px;overflow:hidden;background:linear-gradient(180deg,#171212 0%,#0f0c0c 100%);box-shadow:0 18px 50px rgba(0,0,0,0.36);">
          <div style="padding:32px 28px 18px;border-bottom:1px solid rgba(255,255,255,0.06);background:radial-gradient(circle at top right, rgba(212,175,55,0.14), transparent 42%);">
            <p style="margin:0;color:#d4af37;font-size:11px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;">
              ${escapeHtml(brandName)}
            </p>
            <h1 style="margin:16px 0 0;color:#f6f1eb;font-size:30px;line-height:1.2;font-weight:600;">
              ${escapeHtml(content.headline)}
            </h1>
            <p style="margin:14px 0 0;color:#d3cbc3;font-size:15px;line-height:1.75;">
              ${escapeHtml(content.intro)}
            </p>
          </div>
          <div style="padding:10px 28px 28px;">
            ${sections}
            <div style="margin-top:24px;padding-top:18px;border-top:1px solid rgba(255,255,255,0.08);color:#a79e96;font-size:13px;line-height:1.7;">
              Need help? Contact <a href="mailto:${escapeHtml(
                supportEmail
              )}" style="color:#d4af37;text-decoration:none;">${escapeHtml(
    supportEmail
  )}</a>.
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function getBusinessName(intent: EmailIntent) {
  if (!intent.businessId) {
    return null;
  }

  const { data } = await supabaseAdmin
    .from("businesses")
    .select("name")
    .eq("id", intent.businessId)
    .maybeSingle();

  return asString(data?.name);
}

function normalizeItemRows(value: unknown) {
  return asArray(value)
    .map((item) => {
      const record = asRecord(item);
      const name = asString(record.name) || asString(record.title) || "Item";
      const quantity = Math.max(1, asNumber(record.quantity ?? record.qty ?? 1));
      const price =
        record.price === undefined &&
        record.unit_price === undefined &&
        record.amount === undefined
          ? null
          : asNumber(record.price ?? record.unit_price ?? record.amount);

      return { name, quantity, price };
    })
    .filter((item) => Boolean(item.name));
}

function buildOrderItemSummary(
  items: Array<{ name: string; quantity: number; price: number | null }>
) {
  if (items.length === 0) {
    return "Items confirmed";
  }

  return items.map((item) => `${item.name} x${item.quantity}`).join(", ");
}

function buildServiceBookingEmail(record: JsonRecord, intent: EmailIntent): EmailContent {
  const customerSummary = compactCustomerSummary({
    name: asString(record.customer_name) || intent.customerName,
    email: asString(record.customer_email) || intent.customerEmail,
    phone: asString(record.phone) || intent.phone,
  });
  const timeWindow = [
    formatTimeLabel(asString(record.start_time)),
    formatTimeLabel(asString(record.end_time)),
  ]
    .filter(Boolean)
    .join(" - ");
  const serviceMode =
    titleCaseStatus(asString(intent.metadata.service_mode)) ||
    titleCaseStatus(intent.fulfillmentType);
  const location =
    asString(record.client_address) ||
    formatAddress(intent.address) ||
    (serviceMode === "Remote" ? "Remote service" : null);
  const total = formatCurrency(
    asNumber(record.amount_total ?? record.total_amount)
  );
  const paymentStatus =
    titleCaseStatus(asString(record.payment_status)) || "Paid";

  return {
    subject: "Your service booking is confirmed",
    preview: "Your booking details are confirmed and ready.",
    headline: "Booking confirmed",
    intro:
      "Your payment was received and your service booking is now confirmed. Keep this email for your records.",
    sections: [
      {
        title: "Booking",
        items: [
          {
            label: "Reference",
            value: asString(record.id) || "Confirmed booking",
          },
          {
            label: "Service",
            value: asString(intent.metadata.service_name) || "Service booking",
          },
          {
            label: "Date",
            value: formatDateLabel(asString(record.date)) || "Scheduled",
          },
          ...(timeWindow ? [{ label: "Time", value: timeWindow }] : []),
          ...(serviceMode ? [{ label: "Mode", value: serviceMode }] : []),
          ...(location ? [{ label: "Location", value: location }] : []),
        ],
      },
      {
        title: "Customer",
        items: customerSummary
          ? [{ label: "Details", value: customerSummary }]
          : [],
      },
      {
        title: "Payment",
        items: [
          ...(total ? [{ label: "Total paid", value: total }] : []),
          { label: "Status", value: paymentStatus },
        ],
      },
    ],
  };
}

async function buildRentalReservationEmail(
  record: JsonRecord,
  intent: EmailIntent
): Promise<EmailContent> {
  const customerSummary = compactCustomerSummary({
    name: asString(record.guest_name) || intent.customerName,
    email: asString(record.guest_email) || intent.customerEmail,
    phone: asString(record.guest_phone) || intent.phone,
  });
  const amountTotal = asNumber(record.amount_total);
  const total =
    formatCurrency(amountTotal / 100) ||
    formatCurrency(amountTotal);
  const paymentStatus =
    titleCaseStatus(asString(record.payment_status)) || "Paid";
  const propertyId = asString(record.property_id) || asString(intent.metadata.property_id);
  let propertyName = asString(intent.metadata.property_name);

  if (!propertyName && propertyId) {
    const { data } = await supabaseAdmin
      .from("property")
      .select("name")
      .eq("id", propertyId)
      .maybeSingle();
    propertyName = asString(data?.name);
  }

  return {
    subject: "Your reservation is confirmed",
    preview: "Your stay details are confirmed and ready.",
    headline: "Reservation confirmed",
    intro:
      "Your payment was received and your reservation is now confirmed. Keep these stay details handy for reference.",
    sections: [
      {
        title: "Reservation",
        items: [
          {
            label: "Reference",
            value: asString(record.id) || "Confirmed reservation",
          },
          {
            label: "Listing",
            value: propertyName || "Reserved stay",
          },
          {
            label: "Check-in",
            value:
              formatDateLabel(asString(record.check_in_date)) ||
              "Confirmed",
          },
          {
            label: "Check-out",
            value:
              formatDateLabel(asString(record.check_out_date)) ||
              "Confirmed",
          },
        ],
      },
      {
        title: "Guest",
        items: customerSummary
          ? [{ label: "Details", value: customerSummary }]
          : [],
      },
      {
        title: "Payment",
        items: [
          ...(total ? [{ label: "Total paid", value: total }] : []),
          { label: "Status", value: paymentStatus },
        ],
      },
    ],
  };
}

async function buildOrderEmail(
  record: JsonRecord,
  intent: EmailIntent
): Promise<EmailContent> {
  let items: Array<{ name: string; quantity: number; price: number | null }> = [];

  try {
    const orderItemsTable = supabaseAdmin.from("order_items") as unknown as {
      select: (query: string) => {
        eq: (column: string, value: string) => Promise<{
          data: JsonRecord[] | null;
          error: { message: string } | null;
        }>;
      };
    };
    const { data } = await orderItemsTable
      .select("name, quantity, price")
      .eq("order_id", asString(record.id) || "");
    items = normalizeItemRows(data || []);
  } catch {
    items = [];
  }

  if (items.length === 0) {
    items = intent.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    }));
  }

  const isStoreOrder = intent.flowType === "store_order";
  const customerSummary = compactCustomerSummary({
    name: asString(record.customer_name) || intent.customerName,
    email: intent.customerEmail,
    phone: asString(record.customer_phone) || intent.phone,
  });
  const total =
    formatCurrency(asNumber(record.total_amount)) ||
    formatCurrency(intent.items.reduce((sum, item) => sum + item.price * item.quantity, 0));
  const paymentStatus =
    titleCaseStatus(asString(record.payment_status)) || "Paid";
  const fulfillmentType =
    titleCaseStatus(asString(record.fulfillment_type) || intent.fulfillmentType) ||
    "Pickup";
  const address =
    formatAddress(intent.address) ||
    formatAddress(intent.metadata.address);

  return {
    subject: isStoreOrder
      ? "Your order is confirmed"
      : "Your food order is confirmed",
    preview: "Your order has been confirmed and sent to the business.",
    headline: "Order confirmed",
    intro: isStoreOrder
      ? "Your payment was received and your order is now confirmed. The business can proceed with fulfillment."
      : "Your payment was received and your order is now confirmed. The business can begin preparing it now.",
    sections: [
      {
        title: "Order",
        items: [
          {
            label: "Reference",
            value: asString(record.id) || "Confirmed order",
          },
          {
            label: "Items",
            value: buildOrderItemSummary(items),
          },
        ],
      },
      {
        title: "Customer",
        items: customerSummary
          ? [{ label: "Details", value: customerSummary }]
          : [],
      },
      {
        title: "Fulfillment",
        items: [
          { label: "Method", value: fulfillmentType },
          ...(fulfillmentType === "Delivery" && address
            ? [{ label: "Address", value: address }]
            : []),
        ],
      },
      {
        title: "Payment",
        items: [
          ...(total ? [{ label: "Total paid", value: total }] : []),
          { label: "Status", value: paymentStatus },
        ],
      },
    ],
  };
}

async function getSourceRecord(writeResult: EmailWriteResult) {
  if (writeResult.sourceTable === "bookings") {
    const { data } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, date, start_time, end_time, customer_name, customer_email, phone, amount_total, total_amount, client_address, payment_status"
      )
      .eq("id", writeResult.recordId)
      .maybeSingle();
    return asRecord(data);
  }

  if (writeResult.sourceTable === "rental_reservations") {
    const { data } = await supabaseAdmin
      .from("rental_reservations")
      .select(
        "id, property_id, guest_name, guest_email, guest_phone, check_in_date, check_out_date, amount_total, payment_status"
      )
      .eq("id", writeResult.recordId)
      .maybeSingle();
    return asRecord(data);
  }

  const ordersTable = supabaseAdmin.from("orders") as unknown as {
    select: (query: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{
          data: JsonRecord | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
  const { data } = await ordersTable
    .select(
      "id, customer_name, customer_phone, fulfillment_type, total_amount, payment_status"
    )
    .eq("id", writeResult.recordId)
    .maybeSingle();
  return asRecord(data);
}

export async function sendTransactionConfirmationEmail(input: {
  intent: EmailIntent;
  writeResult: EmailWriteResult;
  context: EmailContext;
}) {
  const { intent, writeResult, context } = input;

  if (!writeResult.confirmationEmailEligible) {
    logEmail("skipped_not_eligible", context, {
      recordId: writeResult.recordId,
      duplicateRetryHandled: writeResult.duplicateRetryHandled,
    });
    return;
  }

  if (!intent.customerEmail) {
    logEmail("skipped_missing_recipient", context, {
      recordId: writeResult.recordId,
    });
    return;
  }

  if (wasConfirmationEmailSent(intent)) {
    logEmail("skipped_already_sent", context, {
      recordId: writeResult.recordId,
    });
    return;
  }

  try {
    const [settings, businessName, record] = await Promise.all([
      getPlatformSettings(),
      getBusinessName(intent),
      getSourceRecord(writeResult),
    ]);

    let content: EmailContent;

    if (intent.flowType === "service_booking") {
      content = buildServiceBookingEmail(record, intent);
    } else if (intent.flowType === "rental_reservation") {
      content = await buildRentalReservationEmail(record, intent);
    } else {
      content = await buildOrderEmail(record, intent);
    }

    const brandName = businessName || settings.platform_name;
    const supportEmail = settings.support_email || "support@seraphnexus.com";
    const html = renderHtml(content, brandName, supportEmail);
    const text = renderText(content, brandName);

    await sendEmail({
      to: intent.customerEmail,
      subject: content.subject,
      html,
      text,
    });

    await markConfirmationEmailSent(intent, writeResult);

    logEmail("sent", context, {
      recordId: writeResult.recordId,
      sourceTableWritten: writeResult.sourceTable,
      flowType: intent.flowType,
    });
  } catch (error) {
    logEmailError("failed", context, error, {
      recordId: writeResult.recordId,
      sourceTableWritten: writeResult.sourceTable,
      flowType: intent.flowType,
    });
  }
}
