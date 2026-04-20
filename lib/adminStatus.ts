type AdminBadgeTone = "attention" | "success" | "destructive" | "informational" | "neutral";
type AdminActionTone =
  | "primary"
  | "secondary"
  | "success"
  | "neutral"
  | "danger"
  | "warning";

function titleCase(input: string) {
  return input
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizeAdminStatusToken(status: string | null | undefined) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");

  if (!normalized) {
    return "unknown";
  }

  if (normalized === "canceled") {
    return "cancelled";
  }

  if (normalized === "complete") {
    return "completed";
  }

  if (normalized === "reply_required") {
    return "awaiting_response";
  }

  return normalized;
}

export function formatAdminStatusLabel(status: string | null | undefined, fallback = "Unknown") {
  const normalized = normalizeAdminStatusToken(status);

  if (normalized === "unknown") {
    return fallback;
  }

  const mapped: Record<string, string> = {
    pending: "Pending",
    confirmed: "Confirmed",
    completed: "Completed",
    fulfilled: "Fulfilled",
    paid: "Paid",
    preparing: "Preparing",
    ready: "Ready",
    cancelled: "Cancelled",
    rejected: "Rejected",
    refunded: "Refunded",
    closed: "Closed",
    new: "New",
    reviewed: "Reviewed",
    contacted: "Contacted",
    qualified: "Qualified",
    unread: "Unread",
    read: "Read",
    replied: "Replied",
    awaiting_response: "Awaiting Response",
    up_to_date: "Up to Date",
    received: "Received",
    draft: "Draft",
    published: "Published",
    archived: "Archived",
  };

  return mapped[normalized] || titleCase(normalized.replace(/_/g, " "));
}

function getBadgeTone(status: string | null | undefined): AdminBadgeTone {
  const normalized = normalizeAdminStatusToken(status);

  if (
    normalized === "cancelled" ||
    normalized === "rejected" ||
    normalized === "refunded" ||
    normalized === "closed" ||
    normalized === "archived"
  ) {
    return "destructive";
  }

  if (
    normalized === "confirmed" ||
    normalized === "completed" ||
    normalized === "fulfilled" ||
    normalized === "paid" ||
    normalized === "contacted" ||
    normalized === "qualified" ||
    normalized === "published" ||
    normalized === "replied" ||
    normalized === "read" ||
    normalized === "up_to_date"
  ) {
    return "success";
  }

  if (
    normalized === "pending" ||
    normalized === "new" ||
    normalized === "reviewed" ||
    normalized === "awaiting_response" ||
    normalized === "unread"
  ) {
    return "attention";
  }

  if (
    normalized === "preparing" ||
    normalized === "ready" ||
    normalized === "received" ||
    normalized === "draft"
  ) {
    return "informational";
  }

  return "neutral";
}

export function getAdminStatusBadgeClass(status: string | null | undefined) {
  const tone = getBadgeTone(status);

  if (tone === "attention") {
    return "border-[var(--warning)] bg-[var(--warning-bg)] text-[var(--warning)]";
  }

  if (tone === "success") {
    return "border-[var(--success)] bg-[var(--success-bg)] text-[var(--success)]";
  }

  if (tone === "destructive") {
    return "border-[var(--destructive)] bg-[var(--destructive-bg)] text-[var(--destructive)]";
  }

  if (tone === "informational") {
    return "border-[var(--info)] bg-[var(--info-bg)] text-[var(--info)]";
  }

  return "border-[var(--border-soft)] bg-[var(--muted-bg)] text-[var(--text-soft)]";
}

export function getAdminStatusPresentation(
  status: string | null | undefined,
  fallback?: string
) {
  return {
    label: formatAdminStatusLabel(status, fallback),
    className: getAdminStatusBadgeClass(status),
  };
}

export function getAdminActionButtonClass(tone: AdminActionTone) {
  if (tone === "primary") {
    return "btn-primary px-4 py-2 text-sm font-medium";
  }

  if (tone === "secondary") {
    return "btn-secondary px-4 py-2 text-sm font-medium";
  }

  if (tone === "success") {
    return "btn-primary px-4 py-2 text-sm font-medium";
  }

  if (tone === "warning") {
    return "btn-secondary px-4 py-2 text-sm font-medium";
  }

  if (tone === "danger") {
    return "rounded-xl border border-[var(--destructive)] bg-[var(--destructive-bg)] px-4 py-2 text-sm font-medium text-[var(--destructive)] transition";
  }

  return "btn-secondary px-4 py-2 text-sm font-medium";
}
