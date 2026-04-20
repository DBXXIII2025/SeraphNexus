import { redirect } from "next/navigation";
import { getPlatformAdminSession } from "@/lib/platformAdmin";
import { getPlatformAdminData } from "@/lib/platformAdminData";

type SearchParams = {
  q?: string;
  plan?: string;
  type?: string;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "No signal";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString();
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export default async function AdminBusinessesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const { isPlatformAdmin } = await getPlatformAdminSession();

  if (!isPlatformAdmin) {
    redirect("/admin");
  }

  console.info("[admin/businesses] resolved admin mode", {
    mode: "platform engineer",
    platformControlsVisible: true,
    canonicalControlCenter: "/admin",
  });

  const params = searchParams ? await searchParams : undefined;
  const query = String(params?.q || "").trim().toLowerCase();
  const planFilter = String(params?.plan || "").trim().toLowerCase();
  const typeFilter = String(params?.type || "").trim().toLowerCase();
  const data = await getPlatformAdminData();

  const rows = data.businessRows.filter((business) => {
    if (
      planFilter &&
      business.effectivePlan !== planFilter &&
      business.storedPlan !== planFilter
    ) {
      return false;
    }

    if (typeFilter && (business.businessType || "").toLowerCase() !== typeFilter) {
      return false;
    }

    if (!query) {
      return true;
    }

    return [
      business.name,
      business.ownerEmail,
      business.businessType,
      business.effectivePlan,
      business.storedPlan,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  return (
    <div className="space-y-6 text-[var(--text-main)]">
      <section className="surface-card p-6">
        <div className="section-header">
          <div className="section-header-copy">
            <p className="section-kicker">Businesses</p>
            <h1 className="section-title">Business management</h1>
            <p className="section-description">
              Platform-wide view of business plan, readiness, legal posture, and revenue signal.
            </p>
          </div>
          <form className="grid gap-3 md:grid-cols-3 lg:min-w-[640px]">
            <input
              name="q"
              defaultValue={query}
              placeholder="Search business or owner"
              className="input-field"
            />
            <input name="plan" defaultValue={planFilter} placeholder="Plan" className="input-field" />
            <input name="type" defaultValue={typeFilter} placeholder="Type" className="input-field" />
          </form>
        </div>
      </section>

      <section className="surface-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[rgba(15,12,12,0.82)] text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Business</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">Type / Plan</th>
                <th className="px-4 py-3 font-medium">Readiness</th>
                <th className="px-4 py-3 font-medium">Legal</th>
                <th className="px-4 py-3 font-medium">Revenue</th>
                <th className="px-4 py-3 font-medium">Activity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((business) => (
                <tr key={business.id} className="border-t border-[var(--border-soft)]">
                  <td className="px-4 py-4">
                    <p className="font-medium text-[var(--text-strong)]">{business.name}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{business.id}</p>
                  </td>
                  <td className="px-4 py-4 text-[var(--text-soft)]">
                    {business.ownerEmail || "Unknown"}
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-[var(--text-strong)]">{business.businessType || "business"}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Effective {business.effectivePlan}
                      {business.effectivePlan !== business.storedPlan
                        ? ` | Stored ${business.storedPlan}`
                        : ""}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <p className={business.stripeReady ? "text-emerald-300" : "text-amber-300"}>
                      {business.stripeReady ? "Stripe ready" : business.stripeConnected ? "Stripe incomplete" : "Stripe disconnected"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {business.isPublished ? "Published" : "Not published"}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <p className={business.legalAccepted ? "text-emerald-300" : "text-amber-300"}>
                      {business.legalAccepted ? "Accepted" : "Missing acceptance"}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-[var(--text-strong)]">{formatCurrency(business.grossRevenue)}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Platform {formatCurrency(business.platformRevenue)} - {business.transactions} txns
                    </p>
                  </td>
                  <td className="px-4 py-4 text-[var(--text-soft)]">
                    <p>Created {formatDateTime(business.createdAt)}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Last activity {formatDateTime(business.lastActivityAt)}
                    </p>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr className="border-t border-[var(--border-soft)]">
                  <td colSpan={7} className="px-4 py-10">
                    <div className="empty-state">
                      No businesses matched the current search and filter combination.
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
