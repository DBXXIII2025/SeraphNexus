import { createAdminClient } from "@/lib/supabase/server";

export const PLATFORM_SUPPORT_SOURCE = "platform_support";
export const PLATFORM_SUPPORT_SUBJECT = "Platform support";

type LooseRow = Record<string, unknown>;

export type PlatformSupportConversationSummary = {
  id: string;
  businessId: string;
  businessName: string | null;
  businessType: string | null;
  ownerUserId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  subject: string | null;
  lastMessageAt: string | null;
  lastMessageExcerpt: string | null;
  unreadForPlatform: number;
  unreadForBusiness: number;
  status: "awaiting_platform" | "awaiting_business" | "up_to_date";
};

export type PlatformSupportMessageItem = {
  id: string;
  conversationId: string;
  body: string;
  createdAt: string | null;
  senderType: "business_owner" | "platform_admin";
  isRead: boolean;
  readAt: string | null;
  senderUserId: string | null;
};

function asString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}


export async function findOrCreatePlatformSupportConversation(args: {
  businessId: string;
  businessName: string | null;
  businessType: string | null;
  ownerUserId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
}) {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("business_id", args.businessId)
    .eq("client_user_id", args.ownerUserId)
    .eq("source", PLATFORM_SUPPORT_SOURCE)
    .eq("context_type", PLATFORM_SUPPORT_SOURCE)
    .order("updated_at", { ascending: false })
    .maybeSingle();

  if (existing?.id) {
    return String(existing.id);
  }

  const payload = {
    business_id: args.businessId,
    client_user_id: args.ownerUserId,
    client_name: args.ownerName || args.businessName || "Business owner",
    client_email: args.ownerEmail,
    client_phone: args.ownerPhone,
    owner_user_id: null,
    subject: PLATFORM_SUPPORT_SUBJECT,
    context_type: PLATFORM_SUPPORT_SOURCE,
    context_id: args.businessId,
    booking_id: null,
    source: PLATFORM_SUPPORT_SOURCE,
  };

  const { data, error } = await supabase
    .from("conversations")
    .insert(payload)
    .select("id")
    .maybeSingle();

  if (error || !data?.id) {
    throw new Error(error?.message || "Failed to create support conversation");
  }

  return String(data.id);
}

export async function insertPlatformSupportMessage(args: {
  conversationId: string;
  businessId: string;
  senderUserId: string;
  recipientUserId: string | null;
  body: string;
}) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: args.conversationId,
      sender_user_id: args.senderUserId,
      recipient_user_id: args.recipientUserId,
      business_id: args.businessId,
      body: args.body,
      is_read: false,
      read_at: null,
    })
    .select("id")
    .maybeSingle();

  if (error || !data?.id) {
    throw new Error(error?.message || "Failed to send support message");
  }

  await supabase
    .from("conversations")
    .update({
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.conversationId)
    .eq("business_id", args.businessId);
}

export async function getPlatformSupportConversationSummaries(args: {
  businessId?: string | null;
  ownerUserId?: string | null;
}) {
  const supabase = createAdminClient();

  let query = supabase
    .from("conversations")
    .select(
      "id,business_id,client_user_id,client_name,client_email,client_phone,owner_user_id,subject,context_type,context_id,last_message_at,created_at,updated_at,access_token,guest_token,booking_id,source"
    )
    .eq("source", PLATFORM_SUPPORT_SOURCE)
    .eq("context_type", PLATFORM_SUPPORT_SOURCE)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (args.businessId) {
    query = query.eq("business_id", args.businessId);
  }

  if (args.ownerUserId) {
    query = query.eq("client_user_id", args.ownerUserId);
  }

  const { data: conversations, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const safeConversations = (conversations || []) as LooseRow[];
  if (safeConversations.length === 0) {
    return [] as PlatformSupportConversationSummary[];
  }

  const businessIds = Array.from(
    new Set(
      safeConversations
        .map((conversation) => asString(conversation.business_id))
        .filter((value): value is string => Boolean(value))
    )
  );
  const conversationIds = safeConversations
    .map((conversation) => asString(conversation.id))
    .filter((value): value is string => Boolean(value));
  const ownerUserIds = Array.from(
    new Set(
      safeConversations
        .map((conversation) => asString(conversation.client_user_id))
        .filter((value): value is string => Boolean(value))
    )
  );

  const [{ data: businesses }, { data: profiles }, { data: messages, error: messagesError }] =
    await Promise.all([
      supabase
        .from("businesses")
        .select("id,name,business_type,owner_id")
        .in("id", businessIds),
      ownerUserIds.length > 0
        ? supabase.from("profiles").select("id,email").in("id", ownerUserIds)
        : Promise.resolve({ data: [] as LooseRow[], error: null }),
      supabase
        .from("messages")
        .select("id,conversation_id,sender_user_id,body,is_read,created_at")
        .in("conversation_id", conversationIds)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false }),
    ]);

  if (messagesError) {
    throw new Error(messagesError.message);
  }

  const businessById = new Map(
    ((businesses || []) as LooseRow[]).map((business) => [
      String(business.id),
      business,
    ])
  );
  const profileById = new Map(
    ((profiles || []) as LooseRow[]).map((profile) => [String(profile.id), profile])
  );
  const latestMessageByConversationId = new Map<string, string | null>();
  const unreadForPlatformByConversationId = new Map<string, number>();
  const unreadForBusinessByConversationId = new Map<string, number>();
  const conversationById = new Map(
    safeConversations.map((conversation) => [String(conversation.id), conversation])
  );

  ((messages || []) as LooseRow[]).forEach((message) => {
    const conversationId = String(message.conversation_id || "");
    const senderUserId = asString(message.sender_user_id);
    const isRead = message.is_read === true;
    const conversation = conversationById.get(conversationId);

    if (!latestMessageByConversationId.has(conversationId)) {
      latestMessageByConversationId.set(
        conversationId,
        asString(message.body) || null
      );
    }

    if (!conversation) {
      return;
    }

    const businessOwnerId = asString(conversation.client_user_id);

    if (!isRead) {
      if (senderUserId && businessOwnerId && senderUserId === businessOwnerId) {
        unreadForPlatformByConversationId.set(
          conversationId,
          (unreadForPlatformByConversationId.get(conversationId) || 0) + 1
        );
      } else {
        unreadForBusinessByConversationId.set(
          conversationId,
          (unreadForBusinessByConversationId.get(conversationId) || 0) + 1
        );
      }
    }
  });

  return safeConversations.map((conversation) => {
    const businessId = String(conversation.business_id || "");
    const ownerUserId = asString(conversation.client_user_id);
    const business = businessById.get(businessId) || null;
    const ownerProfile = ownerUserId ? profileById.get(ownerUserId) || null : null;
    const unreadForPlatform = unreadForPlatformByConversationId.get(String(conversation.id)) || 0;
    const unreadForBusiness = unreadForBusinessByConversationId.get(String(conversation.id)) || 0;

    let status: PlatformSupportConversationSummary["status"] = "up_to_date";
    if (unreadForPlatform > 0) {
      status = "awaiting_platform";
    } else if (unreadForBusiness > 0) {
      status = "awaiting_business";
    }

    return {
      id: String(conversation.id || ""),
      businessId,
      businessName: asString(business?.name) || null,
      businessType: asString(business?.business_type) || null,
      ownerUserId,
      ownerName: asString(conversation.client_name) || null,
      ownerEmail:
        asString(conversation.client_email) || asString(ownerProfile?.email) || null,
      ownerPhone: asString(conversation.client_phone) || null,
      subject: asString(conversation.subject) || null,
      lastMessageAt: asString(conversation.last_message_at) || null,
      lastMessageExcerpt: latestMessageByConversationId.get(String(conversation.id)) || null,
      unreadForPlatform,
      unreadForBusiness,
      status,
    } satisfies PlatformSupportConversationSummary;
  });
}

export async function getPlatformSupportMessages(conversationId: string) {
  const supabase = createAdminClient();

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id,business_id,client_user_id,owner_user_id,client_name,client_email,client_phone,subject,last_message_at,source,context_type")
    .eq("id", conversationId)
    .eq("source", PLATFORM_SUPPORT_SOURCE)
    .eq("context_type", PLATFORM_SUPPORT_SOURCE)
    .maybeSingle();

  if (conversationError) {
    throw new Error(conversationError.message);
  }

  if (!conversation?.id) {
    return {
      conversation: null,
      messages: [] as PlatformSupportMessageItem[],
    };
  }

  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("id,conversation_id,sender_user_id,body,is_read,read_at,created_at")
    .eq("conversation_id", conversationId)
    .eq("business_id", conversation.business_id)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true });

  if (messagesError) {
    throw new Error(messagesError.message);
  }

  const ownerUserId = asString(conversation.client_user_id);

  return {
    conversation: {
      id: String(conversation.id),
      businessId: String(conversation.business_id),
      ownerUserId,
      ownerName: asString(conversation.client_name),
      ownerEmail: asString(conversation.client_email),
      ownerPhone: asString(conversation.client_phone),
      subject: asString(conversation.subject),
      lastMessageAt: asString(conversation.last_message_at),
    },
    messages: ((messages || []) as LooseRow[]).map((message) => ({
      id: String(message.id || ""),
      conversationId: String(message.conversation_id || ""),
      body: asString(message.body) || "",
      createdAt: asString(message.created_at),
      senderType:
        ownerUserId && asString(message.sender_user_id) === ownerUserId
          ? "business_owner"
          : "platform_admin",
      isRead: message.is_read === true,
      readAt: asString(message.read_at),
      senderUserId: asString(message.sender_user_id),
    })),
  };
}

export async function markPlatformSupportRead(args: {
  conversationId: string;
  reader: "platform" | "business_owner";
  ownerUserId?: string | null;
}) {
  const supabase = createAdminClient();

  const { data: messages } = await supabase
    .from("messages")
    .select("id,sender_user_id,is_read")
    .eq("conversation_id", args.conversationId)
    .eq("is_deleted", false)
    .eq("is_read", false);

  const unreadIds = ((messages || []) as LooseRow[])
    .filter((message) => {
      const senderUserId = asString(message.sender_user_id);

      if (args.reader === "platform") {
        return args.ownerUserId
          ? senderUserId === args.ownerUserId
          : true;
      }

      return !args.ownerUserId || senderUserId !== args.ownerUserId;
    })
    .map((message) => String(message.id || ""))
    .filter(Boolean);

  if (unreadIds.length === 0) {
    return;
  }

  await supabase
    .from("messages")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .in("id", unreadIds);
}


