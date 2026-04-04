type FilterableQuery<T> = {
  eq: (column: string, value: boolean) => T;
};

export type CancellationActor = "client" | "owner" | "system";

export function applyVisibleFilter<T>(query: FilterableQuery<T>) {
  return query.eq("hidden_from_ui", false);
}

export function buildCancellationFields(actor: CancellationActor) {
  return {
    cancelled_at: new Date().toISOString(),
    cancelled_by: actor,
    hidden_from_ui: true,
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
