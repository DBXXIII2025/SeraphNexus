import { createClient } from "@/lib/supabase/server";
import { applyVisibleFilter } from "@/lib/transactionVisibility";
import {
  AdminPageContainer,
  DashboardGrid,
  DashboardPrimaryPanel,
  DashboardSecondaryPanel,
} from "@/components/admin/AdminLayoutSystem";
import { AppNotice, EmptyState, SectionHeader, StatCard } from "@/components/ui/app-ui";

export default async function DashboardCalendarPage() {
  const supabase = await createClient();

  const bookingsTable = supabase.from("bookings") as any;

  const { data: bookings, error } = await applyVisibleFilter(bookingsTable.select("*"));

  if (error) {
    return (
      <AdminPageContainer className="text-[var(--text-main)]">
        <AppNotice tone="error" title="Calendar unavailable">
          Error loading calendar.
        </AppNotice>
      </AdminPageContainer>
    );
  }

  const safeBookings = bookings ?? [];

  return (
    <AdminPageContainer className="text-[var(--text-main)]">
      <SectionHeader
        eyebrow="Legacy Workspace"
        title="Calendar"
        description="Visible bookings for the active workspace."
      />

      <DashboardPrimaryPanel>
        <DashboardGrid className="sm:grid-cols-2">
          <StatCard
            label="Visible bookings"
            value={String(safeBookings.length)}
            detail="Bookings currently available to this dashboard route."
          />
          <StatCard
            label="Source"
            value="Bookings"
            detail="This page keeps the existing bookings query and visibility filter."
            tone="success"
          />
        </DashboardGrid>
      </DashboardPrimaryPanel>

      {safeBookings.length === 0 ? (
        <EmptyState
          title="No bookings yet"
          description="New visible bookings will appear here once customers reserve time."
        />
      ) : (
        <DashboardSecondaryPanel>
          <div className="space-y-3">
            {safeBookings.map((b: any) => (
              <article key={b.id} className="table-row-panel p-4">
                <p className="font-medium text-[var(--text-strong)]">
                  {b.customer_email || "Customer"}
                </p>
                <p className="mt-1 text-sm text-[var(--text-soft)]">
                  {[b.date, b.start_time].filter(Boolean).join(" ")}
                </p>
              </article>
            ))}
          </div>
        </DashboardSecondaryPanel>
      )}
    </AdminPageContainer>
  );
}
