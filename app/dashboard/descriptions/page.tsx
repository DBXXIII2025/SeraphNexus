import { getBusiness } from "@/lib/auth/getBusiness";
import {
  AdminPageContainer,
  DashboardPrimaryPanel,
  DashboardSecondaryPanel,
} from "@/components/admin/AdminLayoutSystem";
import { AppNotice, EmptyState, SectionHeader } from "@/components/ui/app-ui";

export default async function DescriptionsPage() {
  try {
    const { supabase, businessId } = await getBusiness();

    const contentTable = supabase.from("property_content") as any;

    const { data: content, error } = await contentTable
      .select("*")
      .eq("business_id", businessId)
      .single();

    if (error || !content) {
      return (
        <AdminPageContainer className="text-[var(--text-main)]">
          <EmptyState
            title="No description found"
            description="Property content will appear here once a description has been saved."
          />
        </AdminPageContainer>
      );
    }

    return (
      <AdminPageContainer className="text-[var(--text-main)]">
        <DashboardPrimaryPanel>
          <SectionHeader
            eyebrow="Legacy Workspace"
            title="Description"
            description="Saved customer-facing property content for the active business."
          />
        </DashboardPrimaryPanel>

        <DashboardSecondaryPanel>
          <p className="section-kicker">Property Content</p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
            {content.title || "Untitled description"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">
            {content.description || "No description text has been saved yet."}
          </p>
        </DashboardSecondaryPanel>
      </AdminPageContainer>
    );
  } catch (err: any) {
    return (
      <AdminPageContainer className="text-[var(--text-main)]">
        <AppNotice tone="error" title="Description unavailable">
          {err.message}
        </AppNotice>
      </AdminPageContainer>
    );
  }
}
