import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import {
  getRequiredBusinessOwnerDocuments,
} from "@/lib/legalDocuments";
import {
  loadMissingLegalDocumentKeysSafe,
  resolveLegalRedirectPath,
} from "@/lib/legalAcceptance";
import { getPlatformAdminSession } from "@/lib/platformAdmin";
import LegalAcceptanceForm from "./LegalAcceptanceForm";

type SearchParams = {
  businessId?: string;
  next?: string;
};

export default async function LegalAcceptancePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const requestedBusinessId = String(params?.businessId || "").trim();
  const nextPath = resolveLegalRedirectPath(params?.next);

  const { user, isPlatformAdmin } = await getPlatformAdminSession();

  if (!user) {
    const loginNext = new URLSearchParams();
    loginNext.set("next", nextPath);
    if (requestedBusinessId) {
      loginNext.set("businessId", requestedBusinessId);
    }
    redirect(`/login?next=${encodeURIComponent(`/legal/acceptance?${loginNext.toString()}`)}`);
  }

  if (isPlatformAdmin) {
    redirect("/admin/dashboard");
  }

  const business = await getActiveBusiness(requestedBusinessId || undefined);

  if (!business) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)] px-4 py-10 text-[var(--text-main)]">
        <div className="mx-auto max-w-3xl rounded-3xl border border-[var(--border-soft)] bg-[var(--panel)] p-8">
          <h1 className="text-2xl font-semibold text-[var(--text-strong)]">
            Legal acceptance required
          </h1>
          <p className="mt-3 text-sm text-[var(--text-soft)]">
            No business was found for this account. Create or select a business to continue.
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const legalState = await loadMissingLegalDocumentKeysSafe({
    supabase,
    userId: user.id,
    businessId: business.id,
    businessType: business.business_type,
  });
  const missingDocumentKeys = legalState.missingDocumentKeys;

  if (missingDocumentKeys.length === 0) {
    redirect(nextPath);
  }

  const requiredDocuments = getRequiredBusinessOwnerDocuments(business.business_type);

  return (
    <div className="min-h-screen bg-[var(--bg-main)] px-4 py-10 text-[var(--text-main)]">
      <div className="mx-auto max-w-4xl rounded-3xl border border-[var(--border-soft)] bg-[var(--panel)] p-8 shadow-[0_18px_48px_rgba(81,61,10,0.08)]">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-soft)]">
          Legal onboarding
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-[var(--text-strong)]">
          Accept required legal documents
        </h1>
        <p className="mt-3 text-sm text-[var(--text-soft)]">
          Before you can use business-facing platform features for {business.name || "this business"},
          you must review and accept the current legal documents below.
        </p>

        <div className="mt-6 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 text-sm text-[var(--text-soft)]">
          <p>business_id: {business.id}</p>
          <p>
            missing_documents:{" "}
            {missingDocumentKeys.join(", ")}
          </p>
          {legalState.unavailable ? (
            <p className="mt-2 text-[var(--accent-gold-soft)]">
              Legal acceptance storage is currently unavailable. Admin gating will fail open until
              this storage is restored.
            </p>
          ) : null}
        </div>

        <div className="mt-8">
          <LegalAcceptanceForm
            businessId={business.id}
            nextPath={nextPath}
            documents={requiredDocuments}
            disabled={legalState.unavailable}
          />
        </div>
      </div>
    </div>
  );
}
