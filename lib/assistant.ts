import { canAccessPlanFeature } from "@/lib/planConfig";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { getPlatformAdminSession } from "@/lib/platformAdmin";
import { createAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type AssistantMessageRow = Database["public"]["Tables"]["assistant_messages"]["Row"];

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

export type AssistantMessageRecord = Pick<
  AssistantMessageRow,
  "id" | "role" | "content" | "created_at"
>;

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

const MISSING_TABLE_CODES = new Set(["42P01", "42703"]);

function isMissingTableError(error: { code?: string | null } | null | undefined) {
  return Boolean(error?.code && MISSING_TABLE_CODES.has(String(error.code)));
}

function normalizeStoredPlan(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "trial";
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

  const { error } = await supabase.from("assistant_messages").insert(rows);

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
  };
}
