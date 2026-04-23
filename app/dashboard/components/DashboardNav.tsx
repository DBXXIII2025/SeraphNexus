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
    <nav style={{ marginTop: "20px" }}>
      {links.map((link, idx) => (
        <span key={link.href}>
          <Link
            href={link.href}
            className={isActive(link.href) ? "font-semibold" : ""}
          >
            {link.label}
          </Link>
          {idx < links.length - 1 && <br />}
        </span>
      ))}
    </nav>
  );
}
