"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DashboardSidebar() {
  const pathname = usePathname();

  const linkClass = (path: string) =>
    `block px-3 py-2 rounded-md text-sm transition ${
      pathname.startsWith(path)
        ? "bg-purple-600 text-white"
        : "text-gray-400 hover:text-white hover:bg-white/5"
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
