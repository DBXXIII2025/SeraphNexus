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
      className="group relative inline-flex h-[52px] w-[52px] shrink-0 items-center justify-center self-center rounded-[16px] border border-[rgba(212,175,55,0.18)] bg-[linear-gradient(180deg,rgba(22,25,30,0.98),rgba(17,19,23,0.98))] p-[13px] text-[var(--text-strong)] shadow-[0_18px_30px_rgba(0,0,0,0.34)] ring-1 ring-inset ring-[rgba(255,255,255,0.04)] transition duration-200 hover:border-[rgba(212,175,55,0.32)] hover:bg-[linear-gradient(180deg,rgba(34,30,22,0.98),rgba(17,19,23,0.98))] hover:shadow-[0_20px_34px_rgba(0,0,0,0.38)]"
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
        className="h-[26px] w-[26px] shrink-0 text-[var(--text-strong)] transition duration-200 group-hover:text-[var(--accent-soft)]"
        aria-hidden="true"
      >
        <path d="M6 9a6 6 0 1 1 12 0v4.5l1.6 2.2A1 1 0 0 1 18.8 17H5.2a1 1 0 0 1-.8-1.3L6 13.5V9Z" />
        <path d="M10 20a2 2 0 0 0 4 0" />
      </svg>
      {!schemaMissing && unreadCount > 0 ? (
        <span
          className="absolute inline-flex items-center justify-center rounded-full text-[11px] font-bold leading-none text-[#18120d]"
          style={{
            top: -4,
            right: -4,
            minWidth: 20,
            width: 20,
            height: 20,
            border: "1px solid rgba(11,12,14,0.92)",
            background: "linear-gradient(180deg,#e6c76a,#d4af37)",
            boxShadow: "0 8px 18px rgba(0,0,0,0.32)",
          }}
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
