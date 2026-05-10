import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { resolvePlatformName } from "@/lib/platformBranding";
import { sendEmail } from "@/lib/emailProvider";
import { requireEnv } from "@/lib/env";
import { getPlatformSettings } from "@/lib/platformSettings";
import { createAdminClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export type NotificationType =
  | "message_received"
  | "order_created"
  | "purchase_created"
  | "food_order_created"
  | "booking_created"
  | "rental_reservation_created"
  | "platform_broadcast";

export type NotificationRow = {
  id: string;
  recipient_user_id: string;
  business_id: string | null;
  type: NotificationType;
  title: string;
  body: string;
  href: string | null;
  is_read: boolean;
  read_at: string | null;
  broadcast_id: string | null;
  event_key: string | null;
  metadata: Json;
  created_at: string;
  business_name?: string | null;
};

type NotificationEmailInput = {
  to: string;
  subject: string;
  title: string;
  body: string;
  href?: string | null;
};

type NotificationInsertInput = {
  recipientUserId: string;
  businessId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  href?: string | null;
  eventKey?: string | null;
  metadata?: Json;
  broadcastId?: string | null;
  emailTo?: string | null;
  emailSubject?: string | null;
};

type BroadcastInput = {
  senderUserId: string;
  title: string;
  body: string;
  href?: string | null;
};

type BusinessRecipient = {
  businessId: string;
  businessName: string;
  businessType: string | null;
  ownerUserId: string | null;
  email: string | null;
};

type BroadcastRecipient = {
  recipientUserId: string;
  email: string | null;
  businessId: string | null;
  businessName: string | null;
};

const NOTIFICATION_SELECT = [
  "id",
  "recipient_user_id",
  "business_id",
  "type",
  "title",
  "body",
  "href",
  "is_read",
  "read_at",
  "broadcast_id",
  "event_key",
  "metadata",
  "created_at",
].join(",");

function createServiceRoleClient() {
  return createSupabaseClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

function isSchemaMissingError(error: {
  message?: string | null;
  details?: string | null;
  code?: string | null;
} | null | undefined) {
  if (!error) {
    return false;
  }

  const message = `${error.message || ""} ${error.details || ""}`.toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    message.includes("business_notifications") ||
    message.includes("notification_broadcasts")
  );
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asBoolean(value: unknown) {
  return value === true;
}

function toNotificationRow(value: Record<string, unknown>): NotificationRow {
  return {
    id: String(value.id || ""),
    recipient_user_id: String(value.recipient_user_id || ""),
    business_id: asString(value.business_id),
    type: String(value.type || "platform_broadcast") as NotificationType,
    title: String(value.title || ""),
    body: String(value.body || ""),
    href: asString(value.href),
    is_read: asBoolean(value.is_read),
    read_at: asString(value.read_at),
    broadcast_id: asString(value.broadcast_id),
    event_key: asString(value.event_key),
    metadata: (value.metadata || {}) as Json,
    created_at: String(value.created_at || ""),
    business_name: asString(value.business_name),
  };
}

async function getAuthUserEmail(userId: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);

  if (error) {
    console.error("[notifications] auth user lookup failed", {
      userId,
      message: error.message,
    });
    return null;
  }

  return data.user?.email || null;
}

async function getBusinessRecipient(businessId: string): Promise<BusinessRecipient | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("id,name,business_type,owner_id,email")
    .eq("id", businessId)
    .maybeSingle();

  if (error) {
    console.error("[notifications] business recipient lookup failed", {
      businessId,
      message: error.message,
      code: error.code,
    });
    return null;
  }

  if (!data?.id) {
    return null;
  }

  const ownerUserId = asString(data.owner_id);
  const resolvedEmail = asString(data.email) || (ownerUserId ? await getAuthUserEmail(ownerUserId) : null);

  return {
    businessId: String(data.id),
    businessName: asString(data.name) || "Business",
    businessType: asString(data.business_type),
    ownerUserId,
    email: resolvedEmail,
  };
}

async function sendNotificationEmail(input: NotificationEmailInput) {
  const settings = await getPlatformSettings();
  const brandName = resolvePlatformName(settings);
  const href = asString(input.href);
  const actionHtml = href
    ? `<p style="margin-top:22px;"><a href="${href}" style="display:inline-flex;border-radius:999px;background:#d4af37;color:#1c1714;padding:11px 18px;text-decoration:none;font-weight:700;">Open notification</a></p>`
    : "";

  await sendEmail({
    to: input.to,
    subject: input.subject,
    html: `
      <div style="margin:0;padding:32px 0;background:#0f0c0c;font-family:Georgia,'Times New Roman',serif;color:#f6f1eb;">
        <div style="max-width:640px;margin:0 auto;padding:0 18px;">
          <div style="border:1px solid rgba(212,175,55,0.18);border-radius:28px;background:#171212;padding:28px 26px;">
            <p style="margin:0;color:#d4af37;font-size:11px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;">${brandName}</p>
            <h1 style="margin:16px 0 0;font-size:28px;line-height:1.2;">${input.title}</h1>
            <p style="margin:16px 0 0;color:#d3cbc3;font-size:15px;line-height:1.75;">${input.body}</p>
            ${actionHtml}
            <p style="margin:24px 0 0;color:#a79e96;font-size:13px;line-height:1.7;">This notification was sent to your business account.</p>
          </div>
        </div>
      </div>
    `,
    text: [brandName, "", input.title, "", input.body, href ? `Open: ${href}` : ""]
      .filter(Boolean)
      .join("\n"),
  });
}

async function updateNotificationMetadata(notificationId: string, metadata: Json) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("business_notifications")
    .update({ metadata })
    .eq("id", notificationId);

  if (error && !isSchemaMissingError(error)) {
    console.error("[notifications] metadata update failed", {
      notificationId,
      message: error.message,
    });
  }
}

export async function createNotification(input: NotificationInsertInput) {
  const supabase = createAdminClient();
  const payload = {
    recipient_user_id: input.recipientUserId,
    business_id: input.businessId || null,
    type: input.type,
    title: input.title,
    body: input.body,
    href: input.href || null,
    is_read: false,
    read_at: null,
    broadcast_id: input.broadcastId || null,
    event_key: input.eventKey || null,
    metadata: (input.metadata || {}) as Json,
  };

  console.log("[notifications] notification creation payload", payload);

  const { data, error } = await supabase
    .from("business_notifications")
    .insert(payload)
    .select(NOTIFICATION_SELECT)
    .maybeSingle();

  if (error) {
    if (error.code === "23505" && input.eventKey) {
      const { data: existing } = await supabase
        .from("business_notifications")
        .select(NOTIFICATION_SELECT)
        .eq("event_key", input.eventKey)
        .maybeSingle();

      const existingNotification = existing
        ? toNotificationRow(existing as Record<string, unknown>)
        : null;
      const existingMetadata = (existingNotification?.metadata || {}) as Record<string, unknown>;
      let emailSent = false;

      if (existingNotification?.id && input.emailTo && !asString(existingMetadata.email_sent_at)) {
        try {
          await sendNotificationEmail({
            to: input.emailTo,
            subject: input.emailSubject || input.title,
            title: input.title,
            body: input.body,
            href: input.href || null,
          });
          emailSent = true;
          await updateNotificationMetadata(existingNotification.id, {
            ...existingMetadata,
            email_sent_at: new Date().toISOString(),
            email_error: null,
          });
        } catch (emailError) {
          await updateNotificationMetadata(existingNotification.id, {
            ...existingMetadata,
            email_error:
              emailError instanceof Error ? emailError.message : "Unknown notification email failure",
          });
        }
      }

      return {
        notification: existingNotification,
        created: false,
        emailSent,
        schemaMissing: false,
      };
    }

    if (isSchemaMissingError(error)) {
      console.warn("[notifications] schema missing; notification write skipped", {
        type: input.type,
        recipientUserId: input.recipientUserId,
        message: error.message,
      });
      return {
        notification: null,
        created: false,
        emailSent: false,
        schemaMissing: true,
      };
    }

    throw error;
  }

  let emailSent = false;
  const baseMetadata = (input.metadata || {}) as Record<string, unknown>;
  if (input.emailTo) {
    try {
      await sendNotificationEmail({
        to: input.emailTo,
        subject: input.emailSubject || input.title,
        title: input.title,
        body: input.body,
        href: input.href || null,
      });
      emailSent = true;
      if (data?.id) {
        await updateNotificationMetadata(String(data.id), {
          ...baseMetadata,
          email_sent_at: new Date().toISOString(),
          email_error: null,
        });
      }
      console.log("[notifications] email send status", {
        recipientUserId: input.recipientUserId,
        emailTo: input.emailTo,
        status: "sent",
      });
    } catch (emailError) {
      if (data?.id) {
        await updateNotificationMetadata(String(data.id), {
          ...baseMetadata,
          email_error:
            emailError instanceof Error ? emailError.message : "Unknown notification email failure",
        });
      }
      console.error("[notifications] email send status", {
        recipientUserId: input.recipientUserId,
        emailTo: input.emailTo,
        status: "failed",
        message: emailError instanceof Error ? emailError.message : "Unknown notification email failure",
      });
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/notifications");
  revalidatePath("/admin/platform");

  return {
    notification: data ? toNotificationRow(data as Record<string, unknown>) : null,
    created: true,
    emailSent,
    schemaMissing: false,
  };
}

export async function createBusinessEventNotification(input: {
  businessId: string;
  type: NotificationType;
  title: string;
  body: string;
  href?: string | null;
  eventKey: string;
  metadata?: Json;
  emailSubject?: string | null;
}) {
  const recipient = await getBusinessRecipient(input.businessId);
  if (!recipient?.ownerUserId) {
    console.warn("[notifications] recipient resolution skipped", {
      businessId: input.businessId,
      type: input.type,
      reason: "missing_owner_user_id",
    });
    return {
      notification: null,
      created: false,
      emailSent: false,
      schemaMissing: false,
    };
  }

  console.log("[notifications] recipient resolution", {
    businessId: input.businessId,
    recipientUserId: recipient.ownerUserId,
    recipientEmail: recipient.email,
  });

  return createNotification({
    recipientUserId: recipient.ownerUserId,
    businessId: recipient.businessId,
    type: input.type,
    title: input.title,
    body: input.body,
    href: input.href || null,
    eventKey: input.eventKey,
    metadata: input.metadata,
    emailTo: recipient.email,
    emailSubject: input.emailSubject || `${input.title} · ${recipient.businessName}`,
  });
}

export async function createMessageReceivedNotification(input: {
  businessId: string;
  conversationId: string;
  messageId: string;
  senderLabel: string;
}) {
  const compactConversationId = String(input.conversationId || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  const conversationTag = compactConversationId
    ? `CONV-${compactConversationId.slice(0, 6)}`
    : "CONV";

  return createBusinessEventNotification({
    businessId: input.businessId,
    type: "message_received",
    title: "New message received",
    body: `${input.senderLabel} sent a new message in ${conversationTag}.`,
    href: `/admin/messages?conversationId=${encodeURIComponent(input.conversationId)}`,
    eventKey: `message:${input.messageId}`,
    metadata: {
      conversation_id: input.conversationId,
      conversation_tag: conversationTag,
      message_id: input.messageId,
      sender_label: input.senderLabel,
    },
    emailSubject: "New business message received",
  });
}

export async function createTransactionNotification(input: {
  businessId: string;
  businessType?: string | null;
  sourceTable: "orders" | "bookings" | "rental_reservations";
  recordId: string;
  flowType?: string | null;
  recordAction: "created" | "updated" | "none";
}) {
  if (input.recordAction === "none") {
    return null;
  }

  let type: NotificationType = "order_created";
  let title = "New order received";
  let body = "A new paid customer transaction was recorded for this business.";
  let href = "/admin";

  if (input.sourceTable === "bookings") {
    type = "booking_created";
    title = "New booking received";
    body = "A customer completed a new service booking.";
    href = "/admin/bookings";
  } else if (input.sourceTable === "rental_reservations") {
    type = "rental_reservation_created";
    title = "New reservation received";
    body = "A customer completed a new rental or property reservation.";
    href = "/admin/bookings";
  } else if (input.flowType === "food_order" || input.businessType === "restaurant" || input.businessType === "food") {
    type = "food_order_created";
    title = "New food order received";
    body = "A customer placed a new food order.";
    href = "/admin/orders";
  } else if (
    input.flowType === "store_order" ||
    input.businessType === "store" ||
    input.businessType === "creator" ||
    input.businessType === "product"
  ) {
    type = "purchase_created";
    title = "New purchase received";
    body = "A customer completed a new purchase.";
    href = "/admin/orders";
  }

  return createBusinessEventNotification({
    businessId: input.businessId,
    type,
    title,
    body,
    href,
    eventKey: `transaction:${input.sourceTable}:${input.recordId}`,
    metadata: {
      flow_type: input.flowType || null,
      source_table: input.sourceTable,
      record_id: input.recordId,
      record_action: input.recordAction,
    },
    emailSubject: title,
  });
}

async function getBroadcastRecipients() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("id,name,owner_id,email")
    .not("owner_id", "is", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const byUser = new Map<string, BroadcastRecipient>();

  for (const row of data || []) {
    const recipientUserId = asString(row.owner_id);
    if (!recipientUserId || byUser.has(recipientUserId)) {
      continue;
    }

    byUser.set(recipientUserId, {
      recipientUserId,
      email: asString(row.email) || (await getAuthUserEmail(recipientUserId)),
      businessId: asString(row.id),
      businessName: asString(row.name),
    });
  }

  return Array.from(byUser.values());
}

export async function sendPlatformBroadcastNotification(input: BroadcastInput) {
  const supabase = createAdminClient();
  const normalizedHref = asString(input.href);
  const contentHash = createHash("sha256")
    .update([input.senderUserId, input.title.trim(), input.body.trim(), normalizedHref || ""].join("|"))
    .digest("hex");
  const duplicateCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: duplicate, error: duplicateError } = await supabase
    .from("notification_broadcasts")
    .select("id,created_at")
    .eq("sender_user_id", input.senderUserId)
    .eq("content_hash", contentHash)
    .gte("created_at", duplicateCutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (duplicateError && !isSchemaMissingError(duplicateError)) {
    throw duplicateError;
  }

  if (duplicate?.id) {
    return {
      broadcastId: duplicate.id,
      duplicate: true,
      recipientCount: 0,
      emailRecipientCount: 0,
      schemaMissing: false,
    };
  }

  const { data: broadcast, error: broadcastError } = await supabase
    .from("notification_broadcasts")
    .insert({
      sender_user_id: input.senderUserId,
      title: input.title.trim(),
      body: input.body.trim(),
      href: normalizedHref,
      content_hash: contentHash,
    })
    .select("id")
    .maybeSingle();

  if (broadcastError) {
    if (isSchemaMissingError(broadcastError)) {
      return {
        broadcastId: null,
        duplicate: false,
        recipientCount: 0,
        emailRecipientCount: 0,
        schemaMissing: true,
      };
    }

    throw broadcastError;
  }

  const recipients = await getBroadcastRecipients();
  console.log("[notifications] broadcast recipient count", {
    broadcastId: broadcast?.id || null,
    recipientCount: recipients.length,
  });

  let emailRecipientCount = 0;
  for (const recipient of recipients) {
    const result = await createNotification({
      recipientUserId: recipient.recipientUserId,
      businessId: recipient.businessId,
      type: "platform_broadcast",
      title: input.title.trim(),
      body: input.body.trim(),
      href: normalizedHref || "/admin",
      eventKey: broadcast?.id ? `broadcast:${broadcast.id}:${recipient.recipientUserId}` : null,
      broadcastId: broadcast?.id || null,
      metadata: {
        business_name: recipient.businessName,
      },
      emailTo: recipient.email,
      emailSubject: `Platform notice · ${input.title.trim()}`,
    });

    if (result.emailSent) {
      emailRecipientCount += 1;
    }
  }

  if (broadcast?.id) {
    await supabase
      .from("notification_broadcasts")
      .update({
        recipient_count: recipients.length,
        email_recipient_count: emailRecipientCount,
      })
      .eq("id", broadcast.id);
  }

  return {
    broadcastId: broadcast?.id || null,
    duplicate: false,
    recipientCount: recipients.length,
    emailRecipientCount,
    schemaMissing: false,
  };
}

export async function listNotificationsForUser(userId: string, limit = 40) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("business_notifications")
    .select(`${NOTIFICATION_SELECT}, businesses(name)`)
    .eq("recipient_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isSchemaMissingError(error)) {
      return {
        notifications: [] as NotificationRow[],
        unreadCount: 0,
        schemaMissing: true,
      };
    }

    throw error;
  }

  const notifications = (data || []).map((row) => {
    const record = row as Record<string, unknown> & {
      businesses?: { name?: string | null } | null;
    };
    return toNotificationRow({
      ...record,
      business_name: record.businesses?.name || null,
    });
  });

  return {
    notifications,
    unreadCount: notifications.filter((notification) => !notification.is_read).length,
    schemaMissing: false,
  };
}

export async function getUnreadNotificationCount(userId: string) {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("business_notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_user_id", userId)
    .eq("is_read", false);

  if (error) {
    if (isSchemaMissingError(error)) {
      return {
        unreadCount: 0,
        schemaMissing: true,
      };
    }

    throw error;
  }

  return {
    unreadCount: count || 0,
    schemaMissing: false,
  };
}

export async function markNotificationReadForUser(userId: string, notificationId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("business_notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("id", notificationId)
    .eq("recipient_user_id", userId)
    .eq("is_read", false);

  if (error && !isSchemaMissingError(error)) {
    throw error;
  }

  revalidatePath("/admin");
  revalidatePath("/admin/notifications");
}

export async function markAllNotificationsReadForUser(userId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("business_notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("recipient_user_id", userId)
    .eq("is_read", false);

  if (error && !isSchemaMissingError(error)) {
    throw error;
  }

  revalidatePath("/admin");
  revalidatePath("/admin/notifications");
}
