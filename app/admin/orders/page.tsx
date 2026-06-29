import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { isOrderBusinessType } from "@/lib/businessModules";
import {
  formatAdminStatusLabel,
  getAdminActionButtonClass,
  getAdminStatusBadgeClass,
} from "@/lib/adminStatus";
import { applyVisibleFilter } from "@/lib/transactionVisibility";
import { createAdminTranslator } from "@/lib/adminI18n";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { AppNotice, EmptyState, SectionHeader, StatCard } from "@/components/ui/app-ui";
import {
  AdminPageContainer,
  DashboardGrid,
  DashboardPrimaryPanel,
  DashboardSecondaryPanel,
} from "@/components/admin/AdminLayoutSystem";

type NormalizedItem = {
  name: string;
  quantity: number;
  unitPrice: number | null;
  details: string[];
};

type NormalizedFulfillmentRecord = {
  id: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  amount: number;
  createdAt: string | null;
  fulfillmentType: string | null;
  visibleStatus: string;
  paymentStatus: string | null;
  items: NormalizedItem[];
  notes: string | null;
  address: string | null;
  placedAtLabel: string;
  isFallback: boolean;
  fallbackMessage?: string | null;
};

type LooseRow = Record<string, unknown>;
type OrdersTable = {
  select: (query: string) => {
    eq: (column: string, value: string) => {
      order: (column2: string, options: { ascending: boolean }) => Promise<{
        data: LooseRow[] | null;
      }>;
    };
  };
};
type OrderItemsTable = {
  select: (query: string) => {
    in: (column: string, values: string[]) => Promise<{
      data: LooseRow[] | null;
    }>;
  };
};
type CheckoutIntentsTable = {
  select: (query: string) => {
    eq: (column: string, value: string) => Promise<{
      data: LooseRow[] | null;
    }>;
  };
};

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }

  return value as Record<string, unknown>;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asNumber(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function formatAddress(address: unknown) {
  const record = asRecord(address);
  const parts = [
    asString(record.line1),
    asString(record.line2),
    asString(record.city),
    asString(record.state),
    asString(record.postalCode),
  ].filter((value): value is string => Boolean(value));

  return parts.length > 0 ? parts.join(", ") : null;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "No timestamp";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function collectItemDetails(record: Record<string, unknown>) {
  const details: string[] = [];
  const variant = asString(record.variant_name) || asString(record.variant);
  const notes = asString(record.notes) || asString(record.special_instructions);
  const source = asString(record.source);

  if (variant) {
    details.push(`Variant: ${variant}`);
  }

  if (source) {
    details.push(`Source: ${source}`);
  }

  const modifiers = Array.isArray(record.modifiers)
    ? record.modifiers
        .map((entry) => asString(asRecord(entry).name) || asString(entry))
        .filter((value): value is string => Boolean(value))
    : [];

  if (modifiers.length > 0) {
    details.push(`Modifiers: ${modifiers.join(", ")}`);
  }

  if (notes) {
    details.push(`Notes: ${notes}`);
  }

  return details;
}

function normalizeItems(items: unknown) {
  return asArray(items)
    .map((item): NormalizedItem | null => {
      const record = asRecord(item);
      const name = asString(record.name) || asString(record.title) || "Item";
      const quantity = Math.max(1, asNumber(record.quantity ?? record.qty ?? 1));
      const unitPriceValue = record.price ?? record.unit_price ?? record.amount ?? null;
      const unitPrice =
        unitPriceValue === null || unitPriceValue === undefined
          ? null
          : asNumber(unitPriceValue);

      return {
        name,
        quantity,
        unitPrice: Number.isFinite(unitPrice as number) ? unitPrice : null,
        details: collectItemDetails(record),
      };
    })
    .filter((value): value is NormalizedItem => Boolean(value));
}

function isStoreBusinessType(businessType: string | null | undefined) {
  return (
    businessType === "store" ||
    businessType === "product" ||
    businessType === "creator"
  );
}

function getVisibleOrderStatus(
  status: string | null | undefined,
  paymentStatus: string | null | undefined,
  isStoreBusiness: boolean
) {
  if (!isStoreBusiness) {
    return status || "pending";
  }

  if (status === "completed" || status === "fulfilled") {
    return "fulfilled";
  }

  if (status === "canceled" || status === "cancelled") {
    return "cancelled";
  }

  if (paymentStatus === "paid") {
    return "paid";
  }

  if (status === "received") {
    return "pending";
  }

  return status || paymentStatus || "pending";
}

function canDeleteOrderRecord(record: NormalizedFulfillmentRecord) {
  const status = String(record.visibleStatus || "").toLowerCase();
  const paymentStatus = String(record.paymentStatus || "").toLowerCase();
  return (
    paymentStatus !== "paid" &&
    paymentStatus !== "refunded" &&
    paymentStatus !== "disputed" &&
    (status === "" || status === "pending" || status === "draft" || status === "received")
  );
}

function SummaryCard({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "success" | "alert";
}) {
  return (
    <StatCard
      label={label}
      value={value}
      detail={detail}
      tone={tone === "alert" ? "warning" : tone}
    />
  );
}

function renderOrderCard(
  record: NormalizedFulfillmentRecord,
  isStoreBusiness: boolean
) {
  const locationLabel = isStoreBusiness ? "Shipping / Delivery" : "Pickup / Delivery";
  const canDeleteOrder = canDeleteOrderRecord(record);
  const cancelLabel = canDeleteOrder ? "Delete order" : "Cancel order";
  const cancelConfirm = canDeleteOrder
    ? `Delete ${record.customerName}'s unpaid pending order? This permanently removes the order record.`
    : `Cancel ${record.customerName}'s order and remove it from active operational views?`;

  return (
    <DashboardSecondaryPanel
      key={record.id}
      className={`p-5 ${record.isFallback ? "border-yellow-500/20 bg-yellow-500/10" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-[var(--text-strong)]">{record.customerName}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium capitalize ${getAdminStatusBadgeClass(
                record.visibleStatus
              )}`}
            >
              {formatAdminStatusLabel(record.visibleStatus, "Pending")}
            </span>
            <span className="inline-flex rounded-full border border-[var(--border-soft)] bg-[var(--surface-raised)] px-3 py-1 text-xs font-medium capitalize text-[var(--text-soft)]">
              Payment {formatAdminStatusLabel(record.paymentStatus, "Pending")}
            </span>
            <span className="inline-flex rounded-full border border-[var(--border-soft)] bg-[var(--surface-raised)] px-3 py-1 text-xs font-medium capitalize text-[var(--text-soft)]">
              {formatAdminStatusLabel(record.fulfillmentType, "Pending")}
            </span>
          </div>
          {record.fallbackMessage ? (
            <p className="mt-2 text-sm text-yellow-200">{record.fallbackMessage}</p>
          ) : null}
        </div>

        <div className="text-right">
          <p className="text-lg font-semibold text-[var(--text-strong)]">${record.amount.toFixed(2)}</p>
          <p className="text-xs text-[var(--text-muted)]">{record.placedAtLabel}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="table-row-panel p-4">
          <p className="section-kicker">
            Customer
          </p>
          <div className="mt-2 space-y-1 text-sm text-[var(--text-main)]">
            <p>Name: {record.customerName}</p>
            <p>Email: {record.customerEmail || "No email provided"}</p>
            <p>Phone: {record.customerPhone || "No phone provided"}</p>
          </div>
        </div>

        <div className="table-row-panel p-4">
          <p className="section-kicker">
            Order Details
          </p>
          <div className="mt-2 space-y-2 text-sm text-[var(--text-main)]">
            <p>Placed: {record.placedAtLabel}</p>
            <p>Method: {record.fulfillmentType || "Pending"}</p>
            <div>
              <p className="mb-1">Items</p>
              {record.items.length === 0 ? (
                <p className="text-[var(--text-soft)]">No item details available.</p>
              ) : (
                <div className="space-y-2">
                  {record.items.map((item, index) => (
                    <div key={`${record.id}-item-${index}`} className="form-section p-3">
                      <p>
                        {item.name} x{item.quantity}
                        {item.unitPrice !== null ? ` - $${item.unitPrice.toFixed(2)}` : ""}
                      </p>
                      {item.details.length > 0 ? (
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          {item.details.join(" | ")}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="table-row-panel p-4">
          <p className="section-kicker">
            {locationLabel}
          </p>
          <div className="mt-2 space-y-2 text-sm text-[var(--text-main)]">
            <p>{record.address || "No address required for this order."}</p>
            <p>Notes: {record.notes || "No special instructions."}</p>
          </div>
        </div>
      </div>

      {!record.isFallback ? (
        <div className="mt-4 flex flex-wrap gap-3">
          {isStoreBusiness ? (
            <form action={`/api/admin/orders/${record.id}/status`} method="POST">
              <input type="hidden" name="status" value="fulfilled" />
              <button
                type="submit"
                className={getAdminActionButtonClass("warning")}
              >
                Mark order fulfilled
              </button>
            </form>
          ) : (
            <>
              {record.visibleStatus !== "preparing" ? (
                <form action={`/api/admin/orders/${record.id}/status`} method="POST">
                  <input type="hidden" name="status" value="preparing" />
                  <button
                    type="submit"
                    className={getAdminActionButtonClass("success")}
                  >
                    Mark preparing
                  </button>
                </form>
              ) : null}

              {record.visibleStatus !== "ready" ? (
                <form action={`/api/admin/orders/${record.id}/status`} method="POST">
                  <input type="hidden" name="status" value="ready" />
                  <button
                    type="submit"
                    className={getAdminActionButtonClass("warning")}
                  >
                    Mark order ready
                  </button>
                </form>
              ) : null}

              {record.visibleStatus !== "completed" ? (
                <form action={`/api/admin/orders/${record.id}/status`} method="POST">
                  <input type="hidden" name="status" value="completed" />
                  <button
                    type="submit"
                    className={getAdminActionButtonClass("neutral")}
                  >
                    Mark order completed
                  </button>
                </form>
              ) : null}
            </>
          )}

          {record.visibleStatus !== "cancelled" ? (
            <form action={`/api/admin/orders/${record.id}/status`} method="POST">
              <input type="hidden" name="status" value="canceled" />
              <ConfirmSubmitButton
                type="submit"
                confirmMessage={cancelConfirm}
                className={getAdminActionButtonClass("danger")}
              >
                {cancelLabel}
              </ConfirmSubmitButton>
            </form>
          ) : null}

          <form action={`/api/admin/orders/${record.id}/refund`} method="POST">
            <ConfirmSubmitButton
              type="submit"
              confirmMessage={
                record.paymentStatus === "refunded"
                  ? undefined
                  : `Issue a refund for ${record.customerName}'s order?`
              }
              disabled={record.paymentStatus === "refunded"}
              className="btn-secondary px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            >
              {record.paymentStatus === "refunded" ? "Refunded" : "Issue refund"}
            </ConfirmSubmitButton>
          </form>
        </div>
      ) : null}
    </DashboardSecondaryPanel>
  );
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    success?: string;
  }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const supabase = await createClient();
  const business = await getActiveBusiness();
  const isDev = process.env.NODE_ENV !== "production";
  const isStoreBusiness = isStoreBusinessType(business?.business_type);

  if (!business) {
    return (
      <AdminPageContainer className="text-[var(--text-main)]">
        <DashboardPrimaryPanel>
          {createAdminTranslator(null)("noActiveBusinessFound")}
        </DashboardPrimaryPanel>
      </AdminPageContainer>
    );
  }

  const t = createAdminTranslator(business.language);

  if (!isOrderBusinessType(business.business_type)) {
    return (
      <AdminPageContainer className="text-[var(--text-main)]">
        <DashboardPrimaryPanel>
          {t("orders")} are not enabled for this business type.
        </DashboardPrimaryPanel>
      </AdminPageContainer>
    );
  }

  const ordersTable = supabase.from("orders") as unknown as OrdersTable;
  const { data: orders } = await applyVisibleFilter(
    (ordersTable
      .select("*")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false }) as unknown as {
      eq: (column: string, value: boolean) => Promise<{ data: LooseRow[] | null }>;
    })
  );

  const orderIds = (orders || []).map((order: LooseRow) => String(order.id));
  let orderItemsByOrderId = new Map<string, NormalizedItem[]>();

  if (orderIds.length > 0) {
    try {
      const orderItemsTable = supabase.from("order_items") as unknown as OrderItemsTable;
      const { data: orderItems } = await orderItemsTable
        .select("*")
        .in("order_id", orderIds);

      orderItemsByOrderId = (orderItems || []).reduce(
        (map: Map<string, NormalizedItem[]>, item: LooseRow) => {
          const orderId = String(item.order_id || "");
          const list = map.get(orderId) || [];
          const normalizedItem = item.name
            ? {
                name: String(item.name),
                quantity: Math.max(1, Number(item.quantity || 1)),
                unitPrice: Number.isFinite(Number(item.price))
                  ? Number(item.price)
                  : null,
                details: [],
              }
            : null;

          if (orderId && normalizedItem) {
            list.push(normalizedItem);
            map.set(orderId, list);
          }

          return map;
        },
        new Map<string, NormalizedItem[]>()
      );
    } catch (error) {
      if (isDev) {
        console.log("[admin/orders] order_items unavailable:", error);
      }
    }
  }

  const intentsTable = supabase.from("checkout_intents") as unknown as CheckoutIntentsTable;
  const { data: intentRows } = await intentsTable
    .select("*")
    .eq("business_id", business.id);

  const intentsBySessionId = new Map<string, LooseRow>();
  const intentsByOrderId = new Map<string, LooseRow>();

  (intentRows || []).forEach((intent: LooseRow) => {
    const metadata = asRecord(intent.metadata ?? intent.meta_json);
    const sessionId = asString(intent.stripe_checkout_session_id);
    const orderId = asString(intent.order_id) || asString(metadata.order_id);

    if (sessionId) {
      intentsBySessionId.set(sessionId, intent);
    }
    if (orderId) {
      intentsByOrderId.set(orderId, intent);
    }
  });

  const normalizedOrders: NormalizedFulfillmentRecord[] = (orders || []).map((order: LooseRow) => {
    const intent =
      intentsByOrderId.get(String(order.id)) ||
      intentsBySessionId.get(String(order.stripe_session_id || ""));
    const metadata = asRecord(intent?.metadata ?? intent?.meta_json);
    const items =
      orderItemsByOrderId.get(String(order.id)) ||
      normalizeItems(intent?.order_items ?? intent?.items_json ?? metadata.order_items);

    return {
      id: String(order.id),
      customerName: String(
        order.customer_name ||
          asString(metadata.customer_name) ||
          "Customer"
      ),
      customerEmail:
        asString(order.customer_email) ||
        asString(intent?.customer_email) ||
        asString(metadata.customer_email) ||
        null,
      customerPhone:
        asString(order.customer_phone) ||
        asString(order.phone) ||
        asString(intent?.phone) ||
        asString(metadata.customer_phone) ||
        asString(metadata.phone) ||
        null,
      amount: asNumber(order.total_amount || 0),
      createdAt: asString(order.created_at),
      fulfillmentType:
        asString(order.fulfillment_type) ||
        asString(intent?.fulfillment_type) ||
        asString(metadata.fulfillment_type),
      visibleStatus: getVisibleOrderStatus(
        asString(order.status),
        asString(order.payment_status),
        isStoreBusiness
      ),
      paymentStatus: asString(order.payment_status),
      items,
      notes:
        asString(order.notes) ||
        asString(metadata.notes) ||
        null,
      address: formatAddress(intent?.address_json ?? metadata.address),
      placedAtLabel: formatDateTime(asString(order.created_at)),
      isFallback: false,
    };
  });

  const fallbackRows: NormalizedFulfillmentRecord[] = (intentRows || [])
    .filter((intent: LooseRow) => {
      const kind = String(intent.kind || intent.intent_type || "");
      const status = String(intent.status || "");
      return kind === "order" && status === "paid";
    })
    .filter((intent: LooseRow) => {
      const sessionId = String(intent.stripe_checkout_session_id || "");
      return !(orders || []).some(
        (order: LooseRow) => String(order.stripe_session_id || "") === sessionId
      );
    })
    .map((intent: LooseRow) => {
      const metadata = asRecord(intent.metadata ?? intent.meta_json);

      return {
        id: String(intent.id),
        customerName: String(
          intent.customer_name ||
            asString(metadata.customer_name) ||
            "Customer"
        ),
        customerEmail:
          asString(intent.customer_email) ||
          asString(metadata.customer_email) ||
          null,
        customerPhone:
          asString(intent.phone) ||
          asString(intent.customer_phone) ||
          asString(metadata.customer_phone) ||
          asString(metadata.phone) ||
          null,
        amount: asNumber(intent.amount_total ?? intent.total_cents) / 100,
        createdAt: asString(intent.created_at),
        fulfillmentType:
          asString(metadata.fulfillment_type) ||
          asString(intent.fulfillment_type) ||
          "pending",
        visibleStatus: isStoreBusiness ? "paid" : "received",
        paymentStatus: String(intent.status || "paid"),
        items: normalizeItems(
          intent.order_items ?? intent.items_json ?? metadata.order_items
        ),
        notes: asString(metadata.notes),
        address: formatAddress(intent.address_json ?? metadata.address),
        placedAtLabel: formatDateTime(asString(intent.created_at)),
        isFallback: true,
        fallbackMessage: "Paid checkout captured before order materialization.",
      };
    });

  if (isDev) {
    const safeOrders = orders || [];
    const pendingCount = safeOrders.filter((order: LooseRow) => {
      return (
        getVisibleOrderStatus(
          asString(order.status),
          asString(order.payment_status),
          isStoreBusiness
        ) === "pending"
      );
    }).length;
    const paidCount = safeOrders.filter((order: LooseRow) => {
      return (
        getVisibleOrderStatus(
          asString(order.status),
          asString(order.payment_status),
          isStoreBusiness
        ) === "paid"
      );
    }).length;
    const fulfilledCount = safeOrders.filter((order: LooseRow) => {
      return (
        getVisibleOrderStatus(
          asString(order.status),
          asString(order.payment_status),
          isStoreBusiness
        ) === "fulfilled"
      );
    }).length;
    const preparingCount = safeOrders.filter(
      (order: LooseRow) => order.status === "preparing"
    ).length;
    const readyCount = safeOrders.filter(
      (order: LooseRow) => order.status === "ready"
    ).length;
    const fulfilledNativeCount = safeOrders.filter(
      (order: LooseRow) => order.status === "completed" || order.status === "fulfilled"
    ).length;
    const cancelledCount = safeOrders.filter(
      (order: LooseRow) => order.status === "canceled" || order.status === "cancelled"
    ).length;

    console.log("[admin/orders] fulfillment load counts:", {
      businessId: business.id,
      businessType: business.business_type || null,
      isStoreBusiness,
      orderCount: safeOrders.length,
      pendingCount,
      paidCount,
      fulfilledCount,
      preparingCount,
      readyCount,
      fulfilledNativeCount,
      cancelledCount,
      withAddressCount: normalizedOrders.filter((order) => Boolean(order.address)).length,
      withNotesCount: normalizedOrders.filter((order) => Boolean(order.notes)).length,
      totalItemCount: normalizedOrders.reduce((sum, order) => sum + order.items.length, 0),
      paidIntentFallbackCount: fallbackRows.length,
    });
  }

  const actionableOrders = normalizedOrders.filter(
    (record) => record.visibleStatus !== "completed" && record.visibleStatus !== "fulfilled"
  ).length;
  const readyOrders = normalizedOrders.filter(
    (record) => record.visibleStatus === "ready"
  ).length;
  const paidOrders = normalizedOrders.filter(
    (record) => record.paymentStatus === "paid"
  ).length;

  return (
    <AdminPageContainer className="text-[var(--text-main)]">
      {params?.success === "deleted" ? (
        <AppNotice tone="success">
          Pending unpaid order deleted.
        </AppNotice>
      ) : null}

      {params?.success === "status" ? (
        <AppNotice tone="success">
          Order updated safely.
        </AppNotice>
      ) : null}

      {params?.success === "refunded" ? (
        <AppNotice tone="success">
          Order refunded and removed from active views.
        </AppNotice>
      ) : null}

      <DashboardPrimaryPanel>
        <SectionHeader
          eyebrow={t("orders")}
          title={`${t("orders")} queue`}
          description={
            isStoreBusiness
              ? `Manage incoming product orders for ${business.name}.`
              : `Manage incoming orders for ${business.name}.`
          }
        />
      </DashboardPrimaryPanel>

      <DashboardGrid className="md:grid-cols-3">
        <SummaryCard
          label="Live queue"
          value={String(normalizedOrders.length)}
          detail="Orders scoped to the active business."
        />
        <SummaryCard
          label="Needs action"
          value={String(actionableOrders)}
          detail="Orders not yet completed or fulfilled."
          tone="alert"
        />
        <SummaryCard
          label={isStoreBusiness ? "Paid / fulfilled" : "Ready / paid"}
          value={isStoreBusiness ? String(paidOrders) : `${readyOrders} / ${paidOrders}`}
          detail={
            isStoreBusiness
              ? "Paid commerce orders moving toward fulfillment."
              : "Orders ready for handoff and orders already paid."
          }
          tone="success"
        />
      </DashboardGrid>

      {normalizedOrders.length === 0 && fallbackRows.length === 0 ? (
        <EmptyState
          title={isStoreBusiness ? "No product orders yet" : "No food orders yet"}
          description={
            isStoreBusiness
              ? "New paid storefront orders will appear here."
              : "New order queue activity will appear here."
          }
        />
      ) : (
        <div className="space-y-4">
          {normalizedOrders.map((record) => renderOrderCard(record, isStoreBusiness))}
          {fallbackRows.map((record) => renderOrderCard(record, isStoreBusiness))}
        </div>
      )}
    </AdminPageContainer>
  );
}
