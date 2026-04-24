import Link from "next/link";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { getAdminNav, getBusinessModule } from "@/lib/businessModules";
import {
  AdminPageContainer,
  DashboardGrid,
  DashboardPrimaryPanel,
  MetricCard,
} from "@/components/admin/AdminLayoutSystem";

export default async function DashboardPage() {
  const business = await getActiveBusiness();
  const businessModule = getBusinessModule(business?.business_type);
  const adminNav = getAdminNav(business?.business_type);

  return (
    <AdminPageContainer className="text-[var(--text-main)]">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-[var(--text-soft)]">
          Launch controls for the active business.
        </p>
      </div>

      <DashboardPrimaryPanel>
        <p className="text-sm text-[var(--text-soft)]">Active Business</p>
        <p className="text-lg font-semibold">
          {business ? business.name : "None"}
        </p>
        <p className="mt-1 text-sm text-[var(--text-soft)]">
          {businessModule.label}
          {" - "}
          {businessModule.description}
        </p>
      </DashboardPrimaryPanel>

      <DashboardGrid className="md:grid-cols-2">
        {adminNav.map((item) => (
          <MetricCard key={item.href}>
            <Link href={item.href} className="block no-underline">
              <p className="font-semibold">{item.label}</p>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                Open {item.label.toLowerCase()} for this business.
              </p>
            </Link>
          </MetricCard>
        ))}
      </DashboardGrid>
    </AdminPageContainer>
  );
}
