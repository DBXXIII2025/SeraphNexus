import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  LEGAL_DOCUMENTS,
  getRequiredLegalDocumentKeys,
  type LegalDocumentKey,
} from "@/lib/legalDocuments";
import {
  getMissingLegalDocumentKeys,
  isMissingLegalAcceptancesStorageError,
  resolveLegalRedirectPath,
} from "@/lib/legalAcceptance";
import { getIsPlatformAdminForUserId } from "@/lib/platformAdmin";

type AcceptancePayload = {
  businessId?: string;
  nextPath?: string;
  documentKeys?: string[];
};

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as AcceptancePayload;
    const businessId = String(payload.businessId || "").trim();
    const nextPath = resolveLegalRedirectPath(
      typeof payload.nextPath === "string" ? payload.nextPath : null
    );
    const documentKeys = Array.isArray(payload.documentKeys)
      ? payload.documentKeys.map((key) => String(key))
      : [];

    if (!businessId) {
      return NextResponse.json({ error: "Missing businessId" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isPlatformAdmin = await getIsPlatformAdminForUserId(user.id);

    if (isPlatformAdmin) {
      return NextResponse.json(
        { error: "Platform-owner accounts are not part of tenant legal acceptance." },
        { status: 403 }
      );
    }

    const supabaseAdmin = createAdminClient();
    const { data: business } = await supabaseAdmin
      .from("businesses")
      .select("id, business_type")
      .eq("id", businessId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (process.env.NODE_ENV !== "production") {
      console.log("[legal/accept] request", {
        userId: user.id,
        businessId,
        nextPath,
        submittedDocumentKeys: documentKeys,
      });
      console.log("[legal/accept] ownership", {
        userId: user.id,
        businessId,
        ownsBusiness: Boolean(business?.id),
        businessType: business?.business_type || null,
      });
    }

    if (!business?.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const requiredKeys = getRequiredLegalDocumentKeys(business.business_type);
    const requiredDocumentVersions = requiredKeys.map((documentKey) => ({
      documentKey,
      documentVersion: LEGAL_DOCUMENTS[documentKey].documentVersion,
    }));
    const acceptedAll =
      requiredKeys.length === documentKeys.length &&
      requiredKeys.every((key) => documentKeys.includes(key));

    if (process.env.NODE_ENV !== "production") {
      console.log("[legal/accept] requirements", {
        userId: user.id,
        businessId,
        businessType: business.business_type || null,
        requiredKeys,
        requiredDocumentVersions,
      });
    }

    if (!acceptedAll) {
      return NextResponse.json(
        { error: "All required legal documents must be accepted." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const rows = requiredKeys.map((documentKey) => ({
      user_id: user.id,
      business_id: businessId,
      document_key: documentKey,
      document_version: LEGAL_DOCUMENTS[documentKey as LegalDocumentKey].documentVersion,
      accepted_at: now,
    }));

    if (process.env.NODE_ENV !== "production") {
      console.log("[legal/accept] rows prepared", {
        rowCount: rows.length,
        rows,
      });
    }

    const { error: upsertError } = await supabaseAdmin
      .from("legal_acceptances")
      .upsert(rows, {
        onConflict: "user_id,business_id,document_key,document_version",
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error("[legal/accept] upsert failed", {
        userId: user.id,
        businessId,
        businessType: business.business_type || null,
        message: upsertError.message,
        details: (upsertError as { details?: string | null }).details || null,
        hint: (upsertError as { hint?: string | null }).hint || null,
        code: (upsertError as { code?: string | null }).code || null,
      });
      throw new Error(upsertError.message);
    }

    const expectedVersions = rows.map((row) => row.document_version);
    const expectedKeys = rows.map((row) => row.document_key);
    const { data: persistedRows, error: persistedRowsError } = await supabaseAdmin
      .from("legal_acceptances")
      .select("user_id, business_id, document_key, document_version, accepted_at")
      .eq("user_id", user.id)
      .eq("business_id", businessId)
      .in("document_key", expectedKeys)
      .in("document_version", expectedVersions);

    if (persistedRowsError) {
      console.error("[legal/accept] verification query failed", {
        userId: user.id,
        businessId,
        businessType: business.business_type || null,
        message: persistedRowsError.message,
        details:
          (persistedRowsError as { details?: string | null }).details || null,
        hint: (persistedRowsError as { hint?: string | null }).hint || null,
        code: (persistedRowsError as { code?: string | null }).code || null,
      });
      throw new Error(persistedRowsError.message);
    }

    const persistedLegalRows = ((persistedRows || []) as Array<Record<string, unknown>>).map(
      (row) => ({
        document_key: String(row.document_key) as LegalDocumentKey,
        document_version: String(row.document_version || ""),
      })
    );
    const missingDocumentKeys = getMissingLegalDocumentKeys(
      persistedLegalRows,
      business.business_type
    );

    if (process.env.NODE_ENV !== "production") {
      console.log("[legal/accept] verification", {
        userId: user.id,
        businessId,
        businessType: business.business_type || null,
        expectedCount: rows.length,
        foundCount: persistedRows?.length || 0,
        expectedKeys,
        foundKeys: persistedLegalRows.map((row) => row.document_key),
        missingKeys: missingDocumentKeys,
      });
    }

    if (missingDocumentKeys.length > 0) {
      console.error("[legal/accept] persistence verification failed", {
        userId: user.id,
        businessId,
        businessType: business.business_type,
        expectedKeys,
        foundKeys: persistedLegalRows.map((row) => row.document_key),
        missingKeys: missingDocumentKeys,
      });
      return NextResponse.json(
        { error: "Legal acceptance did not persist correctly." },
        { status: 500 }
      );
    }

    const cookieStore = await cookies();
    cookieStore.set("active_business_id", businessId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return NextResponse.json({ ok: true, redirectTo: nextPath });
  } catch (err: unknown) {
    console.error("[legal/accept] failed:", err);

    if (isMissingLegalAcceptancesStorageError(err)) {
      return NextResponse.json(
        {
          error:
            "Legal acceptance storage is not available yet. Apply the legal_acceptances migration and try again.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to save legal acceptance.",
      },
      { status: 500 }
    );
  }
}
