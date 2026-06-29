import { getBusiness } from "@/lib/auth/getBusiness";
import {
  AdminPageContainer,
  DashboardPrimaryPanel,
  DashboardSecondaryPanel,
} from "@/components/admin/AdminLayoutSystem";
import { AppNotice, EmptyState, SectionHeader } from "@/components/ui/app-ui";

export default async function PropertyPage() {
  try {
    const { supabase, businessId } = await getBusiness();

    const propertyTable = supabase.from("property") as any;

    const { data: properties, error } = await propertyTable
      .select("*")
      .eq("business_id", businessId);

    if (error) {
      return (
        <AdminPageContainer className="text-[var(--text-main)]">
          <AppNotice tone="error" title="Properties unavailable">
            Error loading properties.
          </AppNotice>
        </AdminPageContainer>
      );
    }

    return (
      <AdminPageContainer className="text-[var(--text-main)]">
        <DashboardPrimaryPanel>
          <SectionHeader
            eyebrow="Legacy Workspace"
            title="Properties"
            description="Rental property records connected to the active business."
          />
        </DashboardPrimaryPanel>

        {(properties?.length ?? 0) === 0 ? (
          <EmptyState
            title="No properties found"
            description="Rental listings will appear here once properties are added."
          />
        ) : (
          <DashboardSecondaryPanel>
            <ul className="space-y-3">
              {properties?.map((p: any) => (
                <li key={p.id} className="table-row-panel p-4">
                  <p className="font-medium text-[var(--text-strong)]">{p.name || "Property"}</p>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">
                    Price: {p.price ? `$${p.price}` : "Not set"}
                  </p>
                </li>
              ))}
            </ul>
          </DashboardSecondaryPanel>
        )}
      </AdminPageContainer>
    );
  } catch (err: any) {
    return (
      <AdminPageContainer className="text-[var(--text-main)]">
        <AppNotice tone="error" title="Properties unavailable">
          {err.message}
        </AppNotice>
      </AdminPageContainer>
    );
  }
}
