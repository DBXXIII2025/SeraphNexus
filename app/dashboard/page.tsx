import Link from "next/link";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { getAdminNav, getBusinessModule } from "@/lib/businessModules";
import {
  AdminPageContainer,
  DashboardGrid,
  DashboardPrimaryPanel,
} from "@/components/admin/AdminLayoutSystem";
import { EmptyState, SectionHeader, StatCard } from "@/components/ui/app-ui";

export default async function DashboardPage() {
  const business = await getActiveBusiness();
  const businessModule = getBusinessModule(business?.business_type);
  const adminNav = getAdminNav(business?.business_type);

  return (
    <AdminPageContainer className="text-[var(--text-main)]">
      <SectionHeader
        eyebrow="Legacy Workspace"
        title="Dashboard"
        description="Launch controls for the active business."
      />

      <DashboardPrimaryPanel>
        <DashboardGrid className="md:grid-cols-3">
          <StatCard
            label="Active Business"
            value={business ? business.name : "None"}
            detail="The workspace context used by these legacy routes."
          />
          <StatCard
            label="Module"
            value={businessModule.label}
            detail={businessModule.description}
          />
          <StatCard
            label="Destinations"
            value={String(adminNav.length)}
            detail="Available operating areas for this business type."
            tone="success"
          />
        </DashboardGrid>
      </DashboardPrimaryPanel>

      {adminNav.length === 0 ? (
        <EmptyState
          title="No workspace destinations"
          description="No dashboard links are available for the active business type yet."
        />
      ) : (
        <DashboardGrid className="md:grid-cols-2">
          {adminNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="dashboard-secondary-panel block no-underline transition hover:border-[var(--accent-border)]"
            >
              <p className="font-semibold text-[var(--text-strong)]">{item.label}</p>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                Open {item.label.toLowerCase()} for this business.
              </p>
            </Link>
          ))}
        </DashboardGrid>
      )}
    </AdminPageContainer>
  );
}
