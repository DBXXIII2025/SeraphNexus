"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DashboardSidebar() {
  const pathname = usePathname();

  const linkClass = (path: string) =>
    `block px-3 py-2 rounded-md text-sm transition ${
      pathname.startsWith(path)
        ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
        : "text-[var(--text-soft)] hover:bg-[var(--accent-muted)] hover:text-[var(--accent-soft)]"
    }`;

  return (
    <nav className="space-y-2">
      <Link href="/dashboard" className={linkClass("/dashboard")}>
        Overview
      </Link>

      <Link href="/dashboard/bookings" className={linkClass("/dashboard/bookings")}>
        Transactions
      </Link>

      <Link href="/dashboard/services" className={linkClass("/dashboard/services")}>
        Services
      </Link>

      <Link href="/dashboard/settings" className={linkClass("/dashboard/settings")}>
        Settings
      </Link>

      <Link href="/dashboard/upgrade" className={linkClass("/dashboard/upgrade")}>
        Upgrade
      </Link>

      <Link href="/explore" className={linkClass("/explore")}>
        Explore
      </Link>

      <Link href="/admin" className={linkClass("/admin")}>
        Admin Panel
      </Link>
    </nav>
  );
}
