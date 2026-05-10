import { randomUUID } from "crypto";
import { getBusinessStaffRole } from "@/lib/businessStaff";
import { createAdminClient } from "@/lib/supabase/server";

type ConversationContext = {
  businessId: string;
  bookingId?: string | null;
  reservationId?: string | null;
  clientEmail?: string | null;
  clientName?: string | null;
  clientPhone?: string | null;
  clientUserId?: string | null;
  subject?: string | null;
  contextType?: string | null;
  contextId?: string | null;
  source?: string | null;
};

export type ConversationStatus = "open" | "resolved" | "archived";

export type ConversationRecord = {
  id: string;
  business_id: string;
  client_user_id: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  owner_user_id: string | null;
  subject: string | null;
  context_type: string | null;
  context_id: string | null;
  last_message_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  access_token: string | null;
  guest_token: string | null;
  booking_id: string | null;
  source: string | null;
  status: ConversationStatus;
};

export type ConversationMessageRecord = {
  id: string;
  conversation_id: string;
  sender_user_id: string | null;
  recipient_user_id: string | null;
  business_id: string;
  body: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by_user_id: string | null;
};

type MessageVisibilityRecord = {
  id: string;
  sender_type: "business" | "client";
  is_private?: boolean | null;
};

export type ConversationAccessResult = {
  conversation: ConversationRecord | null;
  business:
    | {
        id: string;
        name: string | null;
        owner_id: string | null;
        is_published: boolean | null;
        business_type: string | null;
      }
    | null;
  role: "business" | "client" | null;
};

export type AdminConversationSummary = {
  id: string;
  tag: string;
  business_id: string;
  client_name: string | null;
  client_email: string;
  subject: string | null;
  client_phone: string | null;
  source: string | null;
  context_type: string | null;
  context_id: string | null;
  booking_id: string | null;
  last_message_at: string | null;
  last_message_excerpt: string | null;
  business_unread_count: number;
  client_unread_count: number;
  status: ConversationStatus;
};

type BusinessConversationContext = {
  id: string;
  name: string | null;
  owner_id: string | null;
  is_published: boolean | null;
  business_type: string | null;
};

type ProfileRecord = {
  id: string;
  email: string | null;
};

type ResolvedConversationContext = {
  contextType: string;
  contextId: string | null;
  subject: string;
  source: string;
};

const CONVERSATION_SELECT =
  "*";
const MESSAGE_SELECT =
  "id,conversation_id,sender_user_id,recipient_user_id,business_id,body,is_read,read_at,created_at,is_deleted,deleted_at,deleted_by_user_id";

function normalizeString(value: string | null | undefined) {
  const trimmed = (value || "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeConversationStatus(value: unknown): ConversationStatus {
  return value === "resolved" || value === "archived" ? value : "open";
}

export function formatConversationTag(conversationId: string) {
  const compact = String(conversationId || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  return compact ? `CONV-${compact.slice(0, 6)}` : "CONV";
}

function applyClientIdentityFilter<T extends {
  eq: (column: string, value: string) => T;
}>(
  query: T,
  context: ConversationContext
) {
  if (context.clientUserId) {
    return query.eq("client_user_id", context.clientUserId);
  }

  const clientEmail = normalizeString(context.clientEmail);
  if (clientEmail) {
    return query.eq("client_email", clientEmail);
  }

  const clientPhone = normalizeString(context.clientPhone);
  if (clientPhone) {
    return query.eq("client_phone", clientPhone);
  }

  throw new Error("Client identity requires an email, phone, or signed-in account.");
}

function pickReusableConversation(
  conversations: Array<Record<string, unknown>> | null | undefined
) {
  const normalized = Array.isArray(conversations)
    ? conversations.map((conversation) =>
        asConversationRecord(conversation as Record<string, unknown>)
      )
    : [];

  return (
    normalized.find((conversation) => conversation.status === "open") || null
  );
}

function resolveConversationContext(
  context: ConversationContext
): ResolvedConversationContext {
  const explicitContextType = normalizeString(context.contextType);
  const explicitContextId = normalizeString(context.contextId);
  const explicitSource = normalizeString(context.source);

  let contextType = "general_inquiry";
  let contextId: string | null = null;

  if (explicitContextType) {
    contextType = explicitContextType;
    contextId = explicitContextId;
  } else if (context.reservationId) {
    contextType = "reservation";
    contextId = context.reservationId;
  } else if (context.bookingId) {
    contextType = "booking";
    contextId = context.bookingId;
  }

  let source = explicitSource || "public_business";
  if (!explicitSource && context.reservationId) {
    source = "reservation";
  } else if (!explicitSource && context.bookingId) {
    source = "booking";
  }

  let subject = normalizeString(context.subject) || "Message Business";
  if (!normalizeString(context.subject) && context.reservationId) {
    subject = "Reservation details";
  } else if (!normalizeString(context.subject) && context.bookingId) {
    subject = "Booking details";
  }

  return {
    contextType,
    contextId,
    subject,
    source,
  };
}

async function getBusinessConversationContext(
  businessId: string
): Promise<BusinessConversationContext | null> {
  const supabase = createAdminClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, owner_id, is_published, business_type")
    .eq("id", businessId)
    .maybeSingle();

  if (!business?.id) {
    return null;
  }

  return {
    id: String(business.id),
    name: business.name ? String(business.name) : null,
    owner_id: business.owner_id ? String(business.owner_id) : null,
    is_published:
      typeof business.is_published === "boolean" ? business.is_published : null,
    business_type: business.business_type ? String(business.business_type) : null,
  };
}

async function hasBusinessConversationAccess(args: {
  business: BusinessConversationContext;
  userId: string;
}) {
  if (args.business.owner_id && args.business.owner_id === args.userId) {
    return true;
  }

  const staffRole = await getBusinessStaffRole({
    businessId: args.business.id,
    userId: args.userId,
  });

  return Boolean(staffRole);
}

export function filterMessagesForRole<T extends MessageVisibilityRecord>(
  messages: T[],
  role: "business" | "client"
) {
  if (role === "business") {
    return messages;
  }

  return messages.filter(
    (message) =>
      message.sender_type === "client" || message.is_private !== true
  );
}

function asConversationRecord(value: Record<string, unknown>): ConversationRecord {
  return {
    id: String(value.id || ""),
    business_id: String(value.business_id || ""),
    client_user_id: value.client_user_id ? String(value.client_user_id) : null,
    client_name: value.client_name ? String(value.client_name) : null,
    client_email: value.client_email ? String(value.client_email) : null,
    client_phone: value.client_phone ? String(value.client_phone) : null,
    owner_user_id: value.owner_user_id ? String(value.owner_user_id) : null,
    subject: value.subject ? String(value.subject) : null,
    context_type: value.context_type ? String(value.context_type) : null,
    context_id: value.context_id ? String(value.context_id) : null,
    last_message_at: value.last_message_at ? String(value.last_message_at) : null,
    created_at: value.created_at ? String(value.created_at) : null,
    updated_at: value.updated_at ? String(value.updated_at) : null,
    access_token: value.access_token ? String(value.access_token) : null,
    guest_token: value.guest_token ? String(value.guest_token) : null,
    booking_id: value.booking_id ? String(value.booking_id) : null,
    source: value.source ? String(value.source) : null,
    status: normalizeConversationStatus(value.status),
  };
}

function asProfileRecord(value: Record<string, unknown>): ProfileRecord {
  return {
    id: String(value.id || ""),
    email: value.email ? String(value.email) : null,
  };
}

function asConversationMessageRecord(
  value: Record<string, unknown>
): ConversationMessageRecord {
  return {
    id: String(value.id || ""),
    conversation_id: String(value.conversation_id || ""),
    sender_user_id: value.sender_user_id ? String(value.sender_user_id) : null,
    recipient_user_id: value.recipient_user_id
      ? String(value.recipient_user_id)
      : null,
    business_id: String(value.business_id || ""),
    body: String(value.body || ""),
    is_read: value.is_read === true,
    read_at: value.read_at ? String(value.read_at) : null,
    created_at: value.created_at ? String(value.created_at) : null,
    is_deleted: value.is_deleted === true,
    deleted_at: value.deleted_at ? String(value.deleted_at) : null,
    deleted_by_user_id: value.deleted_by_user_id
      ? String(value.deleted_by_user_id)
      : null,
  };
}

function getClientIdentityLabel(args: {
  profileEmail: string | null;
  clientUserId: string | null;
  clientPhone?: string | null;
}) {
  if (args.profileEmail) {
    return args.profileEmail;
  }

  if (args.clientPhone) {
    return args.clientPhone;
  }

  if (args.clientUserId) {
    return `User ${args.clientUserId.slice(0, 8)}`;
  }

  return "";
}

export async function upsertConversationForBooking(context: ConversationContext) {
  const supabase = createAdminClient();
  const business = await getBusinessConversationContext(context.businessId);

  if (!business?.id) {
    throw new Error("Business not found");
  }

  const resolved = resolveConversationContext(context);
  let query = supabase
    .from("conversations")
    .select(CONVERSATION_SELECT)
    .eq("business_id", context.businessId)
    .eq("context_type", resolved.contextType);

  if (resolved.contextId) {
    query = query.eq("context_id", resolved.contextId);
  } else {
    query = query.is("context_id", null);
  }

  if (context.bookingId) {
    query = query.eq("booking_id", context.bookingId);
  } else {
    query = query.is("booking_id", null);
  }

  query = applyClientIdentityFilter(query, context);

  const { data: existingRows } = await query
    .order("created_at", { ascending: false })
    .limit(12);
  const existing = pickReusableConversation(existingRows);

  if (process.env.NODE_ENV !== "production") {
    console.log("[messages/upsert] booking-aware lookup", {
      businessId: context.businessId,
      businessType: business.business_type,
      contextType: resolved.contextType,
      contextId: resolved.contextId,
      bookingId: context.bookingId || null,
      reused: Boolean(existing?.id),
    });
  }

  if (existing?.id) {
    if (!existing.owner_user_id && business.owner_id) {
      const { data: updated } = await supabase
        .from("conversations")
        .update({ owner_user_id: business.owner_id })
        .eq("id", existing.id)
        .select(CONVERSATION_SELECT)
        .maybeSingle();

      if (updated?.id) {
        return asConversationRecord(updated as Record<string, unknown>);
      }
    }

    return asConversationRecord(existing as Record<string, unknown>);
  }

  const payload = {
    business_id: context.businessId,
    client_user_id: context.clientUserId || null,
    client_name: context.clientName || null,
    client_email: normalizeString(context.clientEmail),
    client_phone: context.clientPhone || null,
    owner_user_id: business.owner_id,
    subject: resolved.subject,
    context_type: resolved.contextType,
    context_id: resolved.contextId,
    access_token: randomUUID(),
    guest_token: context.clientUserId ? null : randomUUID(),
    booking_id: context.bookingId || null,
    source: resolved.source,
  };

  const { data, error } = await supabase
    .from("conversations")
    .insert(payload)
    .select(CONVERSATION_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[messages/upsert] booking-aware created", {
      businessId: context.businessId,
      businessType: business.business_type,
      contextType: resolved.contextType,
      contextId: resolved.contextId,
      bookingId: context.bookingId || null,
      conversationId: data?.id ? String(data.id) : null,
    });
  }

  return asConversationRecord((data || {}) as Record<string, unknown>);
}

export async function upsertConversationForClientBusiness(context: ConversationContext) {
  const supabase = createAdminClient();
  const business = await getBusinessConversationContext(context.businessId);

  if (!business?.id) {
    throw new Error("Business not found");
  }

  const resolved = resolveConversationContext({
    ...context,
    contextType: context.contextType || "general_inquiry",
    contextId: context.contextId || null,
    source: context.source || "public_business",
  });

  let query = supabase
    .from("conversations")
    .select(CONVERSATION_SELECT)
    .eq("business_id", context.businessId)
    .eq("context_type", resolved.contextType);

  if (resolved.contextId) {
    query = query.eq("context_id", resolved.contextId);
  } else {
    query = query.is("context_id", null);
  }

  if (context.bookingId) {
    query = query.eq("booking_id", context.bookingId);
  } else {
    query = query.is("booking_id", null);
  }

  query = applyClientIdentityFilter(query, context);

  const { data: existingRows } = await query
    .order("created_at", { ascending: false })
    .limit(12);
  const existing = pickReusableConversation(existingRows);

  if (process.env.NODE_ENV !== "production") {
    console.log("[messages/upsert] universal client lookup", {
      businessId: context.businessId,
      businessType: business.business_type,
      contextType: resolved.contextType,
      contextId: resolved.contextId,
      source: resolved.source,
      reused: Boolean(existing?.id),
    });
  }

  if (existing?.id) {
    if (!existing.owner_user_id && business.owner_id) {
      const { data: updated } = await supabase
        .from("conversations")
        .update({
          owner_user_id: business.owner_id,
          client_name: context.clientName || existing.client_name || null,
          client_email: normalizeString(context.clientEmail) || existing.client_email || null,
          client_phone: context.clientPhone || existing.client_phone || null,
        })
        .eq("id", existing.id)
        .select(CONVERSATION_SELECT)
        .maybeSingle();

      if (updated?.id) {
        return asConversationRecord(updated as Record<string, unknown>);
      }
    }

    if (
      existing.client_name !== (context.clientName || null) ||
      existing.client_email !== (normalizeString(context.clientEmail) || null) ||
      existing.client_phone !== (context.clientPhone || null)
    ) {
      const { data: updated } = await supabase
        .from("conversations")
        .update({
          client_name: context.clientName || existing.client_name || null,
          client_email: normalizeString(context.clientEmail) || existing.client_email || null,
          client_phone: context.clientPhone || existing.client_phone || null,
        })
        .eq("id", existing.id)
        .select(CONVERSATION_SELECT)
        .maybeSingle();

      if (updated?.id) {
        return asConversationRecord(updated as Record<string, unknown>);
      }
    }

    return asConversationRecord(existing as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      business_id: context.businessId,
      client_user_id: context.clientUserId || null,
      client_name: context.clientName || null,
      client_email: normalizeString(context.clientEmail),
      client_phone: context.clientPhone || null,
      owner_user_id: business.owner_id,
      subject: resolved.subject,
      context_type: resolved.contextType,
      context_id: resolved.contextId,
      booking_id: context.bookingId || null,
      source: resolved.source,
      access_token: randomUUID(),
      guest_token: context.clientUserId ? null : randomUUID(),
    })
    .select(CONVERSATION_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[messages/upsert] universal client created", {
      businessId: context.businessId,
      businessType: business.business_type,
      contextType: resolved.contextType,
      contextId: resolved.contextId,
      source: resolved.source,
      conversationId: data?.id ? String(data.id) : null,
    });
  }

  return asConversationRecord((data || {}) as Record<string, unknown>);
}

export async function findConversationForClientBusiness(context: ConversationContext) {
  const supabase = createAdminClient();
  const resolved = resolveConversationContext({
    ...context,
    contextType: context.contextType || "general_inquiry",
    contextId: context.contextId || null,
    source: context.source || "public_business",
  });

  let query = supabase
    .from("conversations")
    .select(CONVERSATION_SELECT)
    .eq("business_id", context.businessId)
    .eq("context_type", resolved.contextType);

  if (resolved.contextId) {
    query = query.eq("context_id", resolved.contextId);
  } else {
    query = query.is("context_id", null);
  }

  if (context.bookingId) {
    query = query.eq("booking_id", context.bookingId);
  } else {
    query = query.is("booking_id", null);
  }

  query = applyClientIdentityFilter(query, context);

  const { data } = await query
    .order("created_at", { ascending: false })
    .limit(12);
  return pickReusableConversation(data as Array<Record<string, unknown>> | null);
}

export async function getConversationByAccessToken(accessToken: string) {
  const supabase = createAdminClient();
  const { data: guestConversation } = await supabase
    .from("conversations")
    .select(CONVERSATION_SELECT)
    .eq("guest_token", accessToken)
    .maybeSingle();

  const conversation =
    guestConversation ||
    (
      await supabase
        .from("conversations")
        .select(CONVERSATION_SELECT)
        .eq("access_token", accessToken)
        .maybeSingle()
    ).data;

  if (!conversation?.id) {
    return { conversation: null, business: null };
  }

  const business = await getBusinessConversationContext(String(conversation.business_id));

  if (!business?.id) {
    return { conversation: null, business: null };
  }

  return {
    conversation: asConversationRecord(conversation as Record<string, unknown>),
    business,
  };
}

export async function getConversationByGuestToken(guestToken: string) {
  const supabase = createAdminClient();
  const { data: conversation } = await supabase
    .from("conversations")
    .select(CONVERSATION_SELECT)
    .eq("guest_token", guestToken)
    .maybeSingle();

  if (!conversation?.id) {
    return { conversation: null, business: null };
  }

  const business = await getBusinessConversationContext(String(conversation.business_id));

  if (!business?.id) {
    return { conversation: null, business: null };
  }

  return {
    conversation: asConversationRecord(conversation as Record<string, unknown>),
    business,
  };
}

export async function getConversationMessages(args: {
  conversationId: string;
  businessId: string;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_SELECT)
    .eq("conversation_id", args.conversationId)
    .eq("business_id", args.businessId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return Array.isArray(data)
    ? data.map((message) =>
        asConversationMessageRecord(message as Record<string, unknown>)
      )
    : [];
}

export async function getAuthorizedConversationForUser({
  conversationId,
  userId,
  accessToken,
}: {
  conversationId: string;
  userId?: string | null;
  userEmail?: string | null;
  accessToken?: string | null;
}): Promise<ConversationAccessResult> {
  const supabase = createAdminClient();
  const { data: conversation } = await supabase
    .from("conversations")
    .select(CONVERSATION_SELECT)
    .eq("id", conversationId)
    .maybeSingle();

  if (!conversation?.id) {
    return { conversation: null, business: null, role: null };
  }

  const business = await getBusinessConversationContext(String(conversation.business_id));

  if (!business?.id) {
    return { conversation: null, business: null, role: null };
  }

  const normalizedConversation = asConversationRecord(
    conversation as Record<string, unknown>
  );
  const normalizedAccessToken = normalizeString(accessToken);
  const normalizedGuestToken = normalizeString(normalizedConversation.guest_token);
  const normalizedConversationAccessToken = normalizeString(
    normalizedConversation.access_token
  );

  if (userId && (await hasBusinessConversationAccess({ business, userId }))) {
    return {
      conversation: normalizedConversation,
      business,
      role: "business",
    };
  }

  if (
    userId &&
    normalizedConversation.client_user_id &&
    normalizedConversation.client_user_id === userId
  ) {
    return {
      conversation: normalizedConversation,
      business,
      role: "client",
    };
  }

  if (
    normalizedAccessToken &&
    (normalizedGuestToken === normalizedAccessToken ||
      normalizedConversationAccessToken === normalizedAccessToken)
  ) {
    return {
      conversation: normalizedConversation,
      business,
      role: "client",
    };
  }

  return {
    conversation: normalizedConversation,
    business,
    role: null,
  };
}

export async function getAdminConversationSummaries(args: {
  businessId: string;
}) {
  const supabase = createAdminClient();
  const business = await getBusinessConversationContext(args.businessId);

  if (!business?.id) {
    return [];
  }

  const { data: conversations, error: conversationsError } = await supabase
    .from("conversations")
    .select(CONVERSATION_SELECT)
    .eq("business_id", args.businessId)
    .neq("source", "platform_support")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (conversationsError) {
    throw new Error(conversationsError.message);
  }

  const normalizedConversations = Array.isArray(conversations)
    ? conversations.map((conversation) =>
        asConversationRecord(conversation as Record<string, unknown>)
      )
    : [];

  if (normalizedConversations.length === 0) {
    return [];
  }

  const clientUserIds = Array.from(
    new Set(
      normalizedConversations
        .map((conversation) => conversation.client_user_id)
        .filter((value): value is string => Boolean(value))
    )
  );

  const conversationIds = normalizedConversations.map((conversation) => conversation.id);
  const conversationById = new Map(
    normalizedConversations.map((conversation) => [conversation.id, conversation])
  );

  const [{ data: profiles }, { data: messages, error: messagesError }] = await Promise.all([
    clientUserIds.length > 0
      ? supabase.from("profiles").select("id, email").in("id", clientUserIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null }),
    supabase
      .from("messages")
      .select("conversation_id, recipient_user_id, body, is_read, created_at")
      .in("conversation_id", conversationIds)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false }),
  ]);

  if (messagesError) {
    throw new Error(messagesError.message);
  }

  const profileById = new Map(
    ((profiles || []) as Array<Record<string, unknown>>).map((profile) => {
      const normalized = asProfileRecord(profile);
      return [normalized.id, normalized];
    })
  );

  const latestMessageByConversationId = new Map<string, string | null>();
  const businessUnreadCountByConversationId = new Map<string, number>();
  const clientUnreadCountByConversationId = new Map<string, number>();

  ((messages || []) as Array<Record<string, unknown>>).forEach((message) => {
    const conversationId = String(message.conversation_id || "");
    const recipientUserId = message.recipient_user_id
      ? String(message.recipient_user_id)
      : null;
    const isRead = message.is_read === true;

    if (!latestMessageByConversationId.has(conversationId)) {
      latestMessageByConversationId.set(
        conversationId,
        message.body ? String(message.body) : null
      );
    }

    const conversation = conversationById.get(conversationId);

    if (!conversation) {
      return;
    }

    const ownerUserId = conversation.owner_user_id || business.owner_id;
    const clientUserId = conversation.client_user_id;

    if (!isRead && recipientUserId && ownerUserId && recipientUserId === ownerUserId) {
      businessUnreadCountByConversationId.set(
        conversationId,
        (businessUnreadCountByConversationId.get(conversationId) || 0) + 1
      );
    }

    if (!isRead && recipientUserId && clientUserId && recipientUserId === clientUserId) {
      clientUnreadCountByConversationId.set(
        conversationId,
        (clientUnreadCountByConversationId.get(conversationId) || 0) + 1
      );
    }

    if (!isRead && !clientUserId && recipientUserId === null) {
      clientUnreadCountByConversationId.set(
        conversationId,
        (clientUnreadCountByConversationId.get(conversationId) || 0) + 1
      );
    }
  });

  return normalizedConversations.map((conversation) => {
    const profile = conversation.client_user_id
      ? profileById.get(conversation.client_user_id) || null
      : null;

    return {
      id: conversation.id,
      business_id: conversation.business_id,
      client_name: conversation.client_name || null,
      client_email:
        conversation.client_email ||
        getClientIdentityLabel({
          profileEmail: profile?.email || null,
          clientUserId: conversation.client_user_id,
          clientPhone: conversation.client_phone,
        }),
      subject: conversation.subject,
      client_phone: conversation.client_phone || null,
      source: conversation.source || null,
      context_type: conversation.context_type || null,
      context_id: conversation.context_id || null,
      booking_id: conversation.booking_id || null,
      last_message_at: conversation.last_message_at,
      last_message_excerpt: latestMessageByConversationId.get(conversation.id) || null,
      business_unread_count:
        businessUnreadCountByConversationId.get(conversation.id) || 0,
      client_unread_count: clientUnreadCountByConversationId.get(conversation.id) || 0,
      tag: formatConversationTag(conversation.id),
      status: conversation.status,
    } satisfies AdminConversationSummary;
  });
}

export async function touchConversationAfterMessage({
  conversationId,
}: {
  conversationId: string;
  senderType: "business" | "client";
  body: string;
}) {
  const supabase = createAdminClient();
  await supabase
    .from("conversations")
    .update({
      last_message_at: new Date().toISOString(),
    })
    .eq("id", conversationId);
}

export async function syncConversationLastMessageAt(args: {
  conversationId: string;
  businessId: string;
}) {
  const supabase = createAdminClient();
  const { data: latestMessage, error: latestMessageError } = await supabase
    .from("messages")
    .select("created_at")
    .eq("conversation_id", args.conversationId)
    .eq("business_id", args.businessId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestMessageError) {
    throw new Error(latestMessageError.message);
  }

  const { error: updateError } = await supabase
    .from("conversations")
    .update({
      last_message_at: latestMessage?.created_at
        ? String(latestMessage.created_at)
        : null,
    })
    .eq("id", args.conversationId)
    .eq("business_id", args.businessId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

async function getConversationParticipants(conversationId: string) {
  const supabase = createAdminClient();
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, client_user_id, owner_user_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conversation?.id) {
    return null;
  }

  return {
    id: String(conversation.id),
    client_user_id: conversation.client_user_id
      ? String(conversation.client_user_id)
      : null,
    owner_user_id: conversation.owner_user_id
      ? String(conversation.owner_user_id)
      : null,
  };
}

export async function markConversationReadForBusiness(conversationId: string) {
  const supabase = createAdminClient();
  const conversation = await getConversationParticipants(conversationId);

  if (!conversation?.owner_user_id) {
    return;
  }

  await supabase
    .from("messages")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("conversation_id", conversationId)
    .eq("recipient_user_id", conversation.owner_user_id)
    .eq("is_deleted", false)
    .eq("is_read", false);
}

export async function markConversationReadForClient(conversationId: string) {
  const supabase = createAdminClient();
  const conversation = await getConversationParticipants(conversationId);

  if (!conversation) {
    return;
  }

  let query = supabase
    .from("messages")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("conversation_id", conversationId)
    .eq("is_deleted", false)
    .eq("is_read", false);

  if (conversation.client_user_id) {
    query = query.eq("recipient_user_id", conversation.client_user_id);
  } else {
    query = query.is("recipient_user_id", null);
  }

  await query;
}

export async function markConversationReadForClientAccessToken(accessToken: string) {
  const access = await getConversationByAccessToken(accessToken);

  if (!access.conversation?.id) {
    return;
  }

  await markConversationReadForClient(access.conversation.id);
}
