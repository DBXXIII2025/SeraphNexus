import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { isRentalBusinessType } from "@/lib/businessModules";
import CalendarClient from "./CalendarClient";
import { applyVisibleFilter } from "@/lib/transactionVisibility";
import { AdminPageContainer, DashboardPrimaryPanel } from "@/components/admin/AdminLayoutSystem";

export default async function AdminCalendarPage() {
  const supabase = await createClient();
  const business = await getActiveBusiness();

  if (!business) {
    return (
      <AdminPageContainer className="text-[var(--text-main)]">
        <DashboardPrimaryPanel>
          <h1 className="section-title">Availability</h1>
          <p className="section-description">Select a business to manage scheduling availability.</p>
        </DashboardPrimaryPanel>
      </AdminPageContainer>
    );
  }

  if (isRentalBusinessType(business.business_type)) {
    return (
      <AdminPageContainer className="text-[var(--text-main)]">
        <DashboardPrimaryPanel>
          <div className="section-header-copy">
            <p className="section-kicker">Business</p>
            <h1 className="section-title">Availability</h1>
            <p className="section-description">
              Rental and property availability stays inside the dedicated rentals workspace.
            </p>
          </div>
          <a href="/admin/rentals" className="btn-primary mt-5 inline-flex px-4 py-2 text-sm font-medium">
            Open rentals workspace
          </a>
        </DashboardPrimaryPanel>
      </AdminPageContainer>
    );
  }

  if (business.business_type !== "service") {
    return (
      <AdminPageContainer className="text-[var(--text-main)]">
        <DashboardPrimaryPanel>
          <div className="section-header-copy">
            <p className="section-kicker">Business</p>
            <h1 className="section-title">Availability</h1>
            <p className="section-description">
              Availability scheduling is only available for service businesses in this workspace.
            </p>
          </div>
        </DashboardPrimaryPanel>
      </AdminPageContainer>
    );
  }

  const { data: bookings, error } = await applyVisibleFilter(
    supabase
      .from("bookings")
      .select("id, date, start_time, end_time, customer_email, status")
      .eq("business_id", business.id)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true })
  );

  if (error) {
    return (
      <AdminPageContainer className="text-[var(--text-main)]">
        <DashboardPrimaryPanel>
          <h1 className="section-title">Availability</h1>
          <p className="text-sm text-red-300">Failed to load the service calendar.</p>
        </DashboardPrimaryPanel>
      </AdminPageContainer>
    );
  }

  console.log("[admin/calendar] service booking count:", {
    businessId: business.id,
    businessType: business.business_type || null,
    bookingCount: bookings?.length || 0,
  });

  return (
    <AdminPageContainer className="text-[var(--text-main)]">
      <DashboardPrimaryPanel>
        <div className="section-header-copy">
          <p className="section-kicker">Business</p>
          <h1 className="section-title">Availability</h1>
          <p className="section-description">
            View the live service calendar and keep upcoming appointments organized in one place.
          </p>
        </div>
      </DashboardPrimaryPanel>

      <CalendarClient bookings={bookings ?? []} />
    </AdminPageContainer>
  );
}
