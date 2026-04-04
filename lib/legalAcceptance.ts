import {
  LEGAL_DOCUMENTS,
  getRequiredLegalDocumentKeys,
  type LegalDocumentKey,
} from "@/lib/legalDocuments";

type MinimalSupabase = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => Promise<{
          data: Array<Record<string, unknown>> | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
};

export type LegalAcceptanceRecord = {
  document_key: LegalDocumentKey;
  document_version: string;
};

export function normalizeLegalAcceptanceRows(
  rows: Array<Record<string, unknown>>
): LegalAcceptanceRecord[] {
  return rows.map((row) => ({
    document_key: String(row.document_key) as LegalDocumentKey,
    document_version: String(row.document_version || ""),
  }));
}

export function isMissingLegalAcceptancesStorageError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  const normalized = message.toLowerCase();

  return (
    normalized.includes("legal_acceptances") &&
    (
      normalized.includes("schema cache") ||
      normalized.includes("does not exist") ||
      normalized.includes("relation") ||
      normalized.includes("could not find the table")
    )
  );
}

export function getRequiredLegalDocumentVersions() {
  return getRequiredLegalDocumentKeys(null).map((documentKey) => ({
    documentKey,
    documentVersion: LEGAL_DOCUMENTS[documentKey].documentVersion,
  }));
}

export function getMissingLegalDocumentKeys(
  rows: LegalAcceptanceRecord[],
  businessType: string | null | undefined
): LegalDocumentKey[] {
  const acceptedMap = new Map<LegalDocumentKey, string>();
  const requiredDocumentKeys = getRequiredLegalDocumentKeys(businessType);

  rows.forEach((row) => {
    acceptedMap.set(row.document_key, row.document_version);
  });

  return requiredDocumentKeys.filter((documentKey) => {
    return acceptedMap.get(documentKey) !== LEGAL_DOCUMENTS[documentKey].documentVersion;
  });
}

export async function loadMissingLegalDocumentKeys({
  supabase,
  userId,
  businessId,
  businessType,
}: {
  supabase: MinimalSupabase;
  userId: string;
  businessId: string;
  businessType: string | null | undefined;
}) {
  const query = supabase
    .from("legal_acceptances")
    .select("document_key, document_version")
    .eq("user_id", userId)
    .eq("business_id", businessId);

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return getMissingLegalDocumentKeys(
    normalizeLegalAcceptanceRows((data || []) as Array<Record<string, unknown>>),
    businessType
  );
}

export async function loadMissingLegalDocumentKeysFromRows(args: {
  rows: Array<Record<string, unknown>>;
  businessType: string | null | undefined;
}) {
  return getMissingLegalDocumentKeys(
    normalizeLegalAcceptanceRows(args.rows),
    args.businessType
  );
}

export async function loadMissingLegalDocumentKeysSafe(args: {
  supabase: MinimalSupabase;
  userId: string;
  businessId: string;
  businessType: string | null | undefined;
}) {
  try {
    const missingDocumentKeys = await loadMissingLegalDocumentKeys(args);

    return {
      missingDocumentKeys,
      unavailable: false,
      error: null as Error | null,
    };
  } catch (error) {
    const normalizedError =
      error instanceof Error ? error : new Error("Unknown legal storage error");

    if (isMissingLegalAcceptancesStorageError(normalizedError)) {
      return {
        missingDocumentKeys: getRequiredLegalDocumentKeys(args.businessType),
        unavailable: true,
        error: normalizedError,
      };
    }

    throw normalizedError;
  }
}

export function resolveLegalRedirectPath(nextPath: string | null | undefined) {
  if (!nextPath || !nextPath.startsWith("/")) {
    return "/admin/dashboard";
  }

  if (nextPath.startsWith("/legal")) {
    return "/admin/dashboard";
  }

  if (nextPath === "/admin") {
    return "/admin/dashboard";
  }

  return nextPath;
}
