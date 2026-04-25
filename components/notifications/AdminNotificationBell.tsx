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
      className="group relative inline-flex h-[52px] w-[52px] shrink-0 items-center justify-center self-center rounded-[16px] border border-[rgba(212,175,55,0.2)] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))] p-[13px] text-[var(--text-strong)] shadow-[0_18px_32px_rgba(0,0,0,0.32)] ring-1 ring-inset ring-[rgba(255,255,255,0.05)] transition duration-200 hover:border-[rgba(212,175,55,0.38)] hover:bg-[linear-gradient(180deg,rgba(212,175,55,0.18),rgba(255,255,255,0.07))] hover:shadow-[0_22px_38px_rgba(0,0,0,0.36),0_0_22px_rgba(212,175,55,0.16)]"
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
        className="h-[26px] w-[26px] shrink-0 text-[rgba(246,241,235,0.96)] transition duration-200 group-hover:text-white"
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
            border: "1px solid rgba(8,10,14,0.92)",
            background: "linear-gradient(180deg,#f0cf73,#cf9622)",
            boxShadow: "0 10px 20px rgba(0,0,0,0.38)",
          }}
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
