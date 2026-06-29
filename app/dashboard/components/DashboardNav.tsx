"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/bookings", label: "Transactions" },
  { href: "/dashboard/upgrade", label: "Upgrade" },
  { href: "/dashboard/settings", label: "Settings" },
  { href: "/admin", label: "Admin Panel" },
];

export default function DashboardNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="dashboard-secondary-panel flex flex-wrap gap-3" aria-label="Dashboard navigation">
      {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={isActive(link.href) ? "btn-primary px-4 py-2 text-sm font-medium" : "btn-secondary px-4 py-2 text-sm font-medium"}
            aria-current={isActive(link.href) ? "page" : undefined}
          >
            {link.label}
          </Link>
      ))}
    </nav>
  );
}
