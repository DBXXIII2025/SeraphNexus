import { redirect } from "next/navigation";
import { getPlatformAdminSession } from "@/lib/platformAdmin";
import {
  AdminPageContainer,
  DashboardPrimaryPanel,
} from "@/components/admin/AdminLayoutSystem";

export default async function AdminBroadcastsPage() {
  const { isPlatformAdmin } = await getPlatformAdminSession();

  if (!isPlatformAdmin) {
    redirect("/admin");
  }

  return (
    <AdminPageContainer className="text-[var(--text-main)]">
      <DashboardPrimaryPanel>
        <div className="section-header-copy">
          <p className="section-kicker">Platform</p>
          <h1 className="section-title">Broadcasts</h1>
          <p className="section-description">
            Send a platform-wide update to business accounts without opening the full platform page.
          </p>
        </div>

        <form action="/api/admin/platform/notifications" method="POST" className="mt-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-[var(--text-soft)]">
              <span className="form-label">Broadcast title</span>
              <input name="title" className="input-field mt-2" maxLength={140} required />
            </label>
            <label className="text-sm text-[var(--text-soft)]">
              <span className="form-label">Optional admin link</span>
              <input
                name="href"
                defaultValue="/admin"
                className="input-field mt-2"
                placeholder="/admin"
              />
            </label>
          </div>

          <label className="text-sm text-[var(--text-soft)]">
            <span className="form-label">Message</span>
            <textarea
              name="body"
              className="input-field mt-2 min-h-[132px]"
              maxLength={4000}
              required
            />
          </label>

          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-3 text-sm text-[var(--text-soft)]">
            Broadcasts target business accounts only. Public users and customer accounts are excluded.
          </div>

          <button type="submit" className="btn-primary px-4 py-2 text-sm font-medium">
            Send broadcast
          </button>
        </form>
      </DashboardPrimaryPanel>
    </AdminPageContainer>
  );
}
