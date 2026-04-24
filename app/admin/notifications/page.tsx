import Link from "next/link";
import { getPlatformAdminSession } from "@/lib/platformAdmin";
import { listNotificationsForUser } from "@/lib/notifications";
import {
  AdminPageContainer,
  DashboardPrimaryPanel,
  DashboardSecondaryPanel,
} from "@/components/admin/AdminLayoutSystem";

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Unknown time";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function getTypeLabel(value: string) {
  switch (value) {
    case "message_received":
      return "Message";
    case "food_order_created":
      return "Food order";
    case "purchase_created":
      return "Purchase";
    case "order_created":
      return "Order";
    case "booking_created":
      return "Booking";
    case "rental_reservation_created":
      return "Reservation";
    case "platform_broadcast":
      return "Platform";
    default:
      return "Notification";
  }
}

export default async function AdminNotificationsPage() {
  const { user, isPlatformAdmin } = await getPlatformAdminSession();

  if (!user) {
    return (
      <AdminPageContainer className="text-[var(--text-main)]">
        <DashboardPrimaryPanel>Sign in to review notifications.</DashboardPrimaryPanel>
      </AdminPageContainer>
    );
  }

  const { notifications, unreadCount, schemaMissing } = await listNotificationsForUser(user.id);

  return (
    <AdminPageContainer className="text-[var(--text-main)]">
      <DashboardPrimaryPanel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-kicker">Notifications</p>
            <h1 className="section-title">
              {isPlatformAdmin ? "Platform notifications" : "Business notifications"}
            </h1>
            <p className="section-description">
              Recent account notifications with unread state and destination links.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="status-chip">
              {unreadCount} unread
            </span>
            <form action="/api/admin/notifications" method="POST">
              <input type="hidden" name="action" value="mark_all_read" />
              <input type="hidden" name="redirect_to" value="/admin/notifications" />
              <button type="submit" className="btn-secondary px-4 py-2 text-sm font-medium">
                Mark all read
              </button>
            </form>
          </div>
        </div>
      </DashboardPrimaryPanel>

      {schemaMissing ? (
        <DashboardSecondaryPanel className="border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Notifications are unavailable because the live Supabase API cannot resolve
          {" "}
          <span className="font-mono">public.business_notifications</span>
          {" "}
          in the schema cache. Apply or refresh
          {" "}
          <span className="font-mono">sql/migrations/20260421_business_notifications.sql</span>
          {" "}
          and then refresh the database API schema cache.
        </DashboardSecondaryPanel>
      ) : null}

      <DashboardPrimaryPanel>
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`rounded-2xl border px-4 py-4 ${
                notification.is_read
                  ? "border-[var(--border-soft)] bg-[var(--surface-raised)]"
                  : "border-[var(--accent-border)] bg-[var(--accent-muted)]"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="status-chip">{getTypeLabel(notification.type)}</span>
                    {!notification.is_read ? (
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-soft)]">
                        Unread
                      </span>
                    ) : null}
                    {notification.business_name ? (
                      <span className="text-xs text-[var(--text-muted)]">
                        {notification.business_name}
                      </span>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-base font-semibold text-[var(--text-strong)]">
                      {notification.title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[var(--text-soft)]">
                      {notification.body}
                    </p>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    {formatDateTime(notification.created_at)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {notification.href ? (
                    <Link href={notification.href} className="btn-secondary px-4 py-2 text-sm font-medium">
                      Open
                    </Link>
                  ) : null}
                  {!notification.is_read ? (
                    <form action="/api/admin/notifications" method="POST">
                      <input type="hidden" name="action" value="mark_read" />
                      <input type="hidden" name="notification_id" value={notification.id} />
                      <input type="hidden" name="redirect_to" value="/admin/notifications" />
                      <button type="submit" className="btn-secondary px-4 py-2 text-sm font-medium">
                        Mark read
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            </div>
          ))}

          {notifications.length === 0 ? (
            <div className="empty-state">
              No notifications yet.
            </div>
          ) : null}
        </div>
      </DashboardPrimaryPanel>
    </AdminPageContainer>
  );
}
