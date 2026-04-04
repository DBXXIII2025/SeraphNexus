"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();

  const linkClass = (path: string) =>
    `px-3 py-2 rounded-md text-sm ${
      pathname.startsWith(path)
        ? "bg-purple-600 text-white"
        : "text-gray-400 hover:text-white hover:bg-white/5"
    }`;

  return (
    <header className="border-b border-white/10 bg-black/40 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
        <Link href="/" className="font-bold text-lg">
          Seraph Nexus
        </Link>

        <nav className="flex gap-3">
          <Link href="/dashboard" className={linkClass("/dashboard")}>
            Dashboard
          </Link>

          <Link href="/dashboard/settings" className={linkClass("/dashboard/settings")}>
            Settings
          </Link>

          <Link href="/admin" className={linkClass("/admin")}>
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}