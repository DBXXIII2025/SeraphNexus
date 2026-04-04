type CheckoutIntentAdminClient = {
  from: (table: "checkout_intents") => any;
};

type SchemaTolerantResult = {
  ok: boolean;
  degraded: boolean;
  removedColumns: string[];
  message?: string | null;
};

type InsertCheckoutIntentResult = SchemaTolerantResult & {
  id: string | null;
};

function compactPayload(payload: Record<string, unknown>) {
  return Object.entries(payload).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {});
}

function extractMissingColumnName(message: string) {
  const patterns = [
    /column ["']([^"']+)["']/i,
    /Could not find the ['"]([^'"]+)['"] column/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function isMissingRelationError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("relation") && normalized.includes("does not exist")
  );
}

function isSchemaMismatchError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("column") ||
    normalized.includes("schema cache") ||
    isMissingRelationError(message)
  );
}

function logSchemaFallback(stage: string, extra?: Record<string, unknown>) {
  console.warn("[checkout_intents]", {
    stage,
    ...(extra || {}),
  });
}

export async function insertCheckoutIntentSafely(args: {
  supabaseAdmin: CheckoutIntentAdminClient;
  payload: Record<string, unknown>;
  context: Record<string, unknown>;
}) {
  const candidate = compactPayload(args.payload);
  const removedColumns: string[] = [];

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { data, error } = await args.supabaseAdmin
      .from("checkout_intents")
      .insert(candidate)
      .select("id")
      .maybeSingle();

    if (!error && data?.id) {
      return {
        id: String(data.id),
        ok: true,
        degraded: removedColumns.length > 0,
        removedColumns,
        message: null,
      } satisfies InsertCheckoutIntentResult;
    }

    const message = error?.message || "Failed to create checkout intent";

    if (!isSchemaMismatchError(message)) {
      throw new Error(message);
    }

    if (isMissingRelationError(message)) {
      logSchemaFallback("insert_relation_missing", {
        ...args.context,
        message,
        removedColumns,
      });

      return {
        id: null,
        ok: false,
        degraded: true,
        removedColumns,
        message,
      } satisfies InsertCheckoutIntentResult;
    }

    const missingColumn = extractMissingColumnName(message);
    if (!missingColumn || !(missingColumn in candidate)) {
      throw new Error(message);
    }

    delete candidate[missingColumn];
    removedColumns.push(missingColumn);

    logSchemaFallback("insert_retry_without_column", {
      ...args.context,
      missingColumn,
      removedColumns,
      attempt: attempt + 1,
      message,
    });
  }

  throw new Error("Failed to create checkout intent after schema fallback retries");
}

export async function updateCheckoutIntentSafely(args: {
  supabaseAdmin: CheckoutIntentAdminClient;
  intentId: string;
  payload: Record<string, unknown>;
  context: Record<string, unknown>;
}) {
  const candidate = compactPayload(args.payload);
  const removedColumns: string[] = [];

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { error } = await args.supabaseAdmin
      .from("checkout_intents")
      .update(candidate)
      .eq("id", args.intentId);

    if (!error) {
      return {
        ok: true,
        degraded: removedColumns.length > 0,
        removedColumns,
        message: null,
      } satisfies SchemaTolerantResult;
    }

    const message = error.message || "Failed to update checkout intent";

    if (!isSchemaMismatchError(message)) {
      throw new Error(message);
    }

    if (isMissingRelationError(message)) {
      logSchemaFallback("update_relation_missing", {
        ...args.context,
        intentId: args.intentId,
        message,
        removedColumns,
      });

      return {
        ok: false,
        degraded: true,
        removedColumns,
        message,
      } satisfies SchemaTolerantResult;
    }

    const missingColumn = extractMissingColumnName(message);
    if (!missingColumn || !(missingColumn in candidate)) {
      throw new Error(message);
    }

    delete candidate[missingColumn];
    removedColumns.push(missingColumn);

    logSchemaFallback("update_retry_without_column", {
      ...args.context,
      intentId: args.intentId,
      missingColumn,
      removedColumns,
      attempt: attempt + 1,
      message,
    });
  }

  throw new Error("Failed to update checkout intent after schema fallback retries");
}
