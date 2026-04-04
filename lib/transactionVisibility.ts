type FilterableQuery<T> = {
  eq: (column: string, value: boolean) => T;
};

export type CancellationActor = "client" | "owner" | "system";
export type HiddenReason = "cancelled" | "completed" | "fulfilled";

export function applyVisibleFilter<T>(query: FilterableQuery<T>) {
  return query.eq("hidden_from_ui", false);
}

function getNowIso() {
  return new Date().toISOString();
}

function buildHiddenFields(reason: HiddenReason, timestamp: string) {
  return {
    hidden_from_ui: true,
    hidden_reason: reason,
    hidden_at: timestamp,
  };
}

export function buildCancellationFields(actor: CancellationActor) {
  const timestamp = getNowIso();
  return {
    ...buildHiddenFields("cancelled", timestamp),
    cancelled_at: timestamp,
    cancelled_by: actor,
  };
}

export function buildCancelledStatusUpdate(
  actor: CancellationActor,
  status: "cancelled" | "canceled",
  extra: Record<string, unknown> = {}
) {
  return {
    status,
    ...buildCancellationFields(actor),
    ...extra,
  };
}

export function buildCompletedStatusUpdate(
  status: "completed",
  extra: Record<string, unknown> = {}
) {
  const timestamp = getNowIso();
  return {
    status,
    ...buildHiddenFields("completed", timestamp),
    completed_at: timestamp,
    ...extra,
  };
}

export function buildFulfilledStatusUpdate(
  status: "fulfilled" | "delivered",
  extra: Record<string, unknown> = {}
) {
  const timestamp = getNowIso();
  return {
    status,
    ...buildHiddenFields("fulfilled", timestamp),
    fulfilled_at: timestamp,
    ...extra,
  };
}
