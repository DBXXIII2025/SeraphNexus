import Link from "next/link";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { getAdminNav, getBusinessModule } from "@/lib/businessModules";

export default async function DashboardPage() {
  const business = await getActiveBusiness();
  const businessModule = getBusinessModule(business?.business_type);
  const adminNav = getAdminNav(business?.business_type);

  return (
    <div className="text-[var(--text-main)]">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-[var(--text-soft)]">
          Launch controls for the active business.
        </p>
      </div>

      <div className="mb-8 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-6">
        <p className="text-sm text-[var(--text-soft)]">Active Business</p>
        <p className="text-lg font-semibold">
          {business ? business.name : "None"}
        </p>
        <p className="mt-1 text-sm text-[var(--text-soft)]">
          {businessModule.label}
          {" - "}
          {businessModule.description}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {adminNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 transition hover:border-[var(--border-strong)]"
          >
            <p className="font-semibold">{item.label}</p>
            <p className="text-sm text-[var(--text-soft)]">
              Open {item.label.toLowerCase()} for this business.
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
