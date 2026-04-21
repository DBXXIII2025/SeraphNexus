import Link from "next/link";
import { getUnreadNotificationCount } from "@/lib/notifications";

export default async function AdminNotificationBell({
  userId,
}: {
  userId: string;
}) {
  const { unreadCount, schemaMissing } = await getUnreadNotificationCount(userId);

  return (
    <Link
      href="/admin/notifications"
      className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface-raised)] text-[var(--text-strong)] transition hover:border-[var(--border-strong)] hover:bg-[var(--accent-muted)]"
      aria-label={
        schemaMissing
          ? "Notifications unavailable"
          : unreadCount > 0
            ? `${unreadCount} unread notifications`
            : "Notifications"
      }
      title={schemaMissing ? "Notifications unavailable until the notifications migration is applied." : "Notifications"}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d="M6 9a6 6 0 1 1 12 0v4.5l1.6 2.2A1 1 0 0 1 18.8 17H5.2a1 1 0 0 1-.8-1.3L6 13.5V9Z" />
        <path d="M10 20a2 2 0 0 0 4 0" />
      </svg>
      {!schemaMissing && unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-[11px] font-semibold text-[var(--accent-contrast)]">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
