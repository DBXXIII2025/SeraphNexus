export type ConfirmationState = "confirmed" | "finalizing" | "needs_attention";

export type ConfirmationSectionItem = {
  label: string;
  value: string;
};

export type ConfirmationSection = {
  title: string;
  items: ConfirmationSectionItem[];
};

export type TransactionConfirmationPayload = {
  state: ConfirmationState;
  transactionType:
    | "service_booking"
    | "rental_reservation"
    | "food_order"
    | "store_order";
  headline: string;
  message: string;
  nextStep: string;
  reference: string | null;
  paymentSummary: string | null;
  businessName: string | null;
  businessSlug: string | null;
  businessType: string | null;
  primaryActionLabel?: string | null;
  primaryActionHref?: string | null;
  secondaryActionLabel?: string | null;
  secondaryActionHref?: string | null;
  sections: ConfirmationSection[];
};

export function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }

  return value as Record<string, unknown>;
}

export function asArray(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }

  return [];
}

export function asString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatCurrency(amount: number | null | undefined) {
  if (!Number.isFinite(Number(amount))) {
    return null;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(amount));
}

export function formatDateLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

export function formatTimeLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const [hoursText, minutesText] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText ?? "0");

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return value;
  }

  const parsed = new Date();
  parsed.setHours(hours, minutes, 0, 0);

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

export function formatAddress(value: unknown) {
  const record = asRecord(value);
  const parts = [
    asString(record.line1),
    asString(record.line2),
    asString(record.city),
    asString(record.state),
    asString(record.postalCode),
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(", ") : null;
}

export function titleCaseStatus(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function compactCustomerSummary(input: {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}) {
  const parts = [input.name, input.email, input.phone].filter(
    (part): part is string => Boolean(part && part.trim())
  );

  return parts.length > 0 ? parts.join(" | ") : null;
}
