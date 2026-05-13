import "./globals.css";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Navbar from "@/components/navigation/Navbar";
import LegalBrandingNotice from "@/components/legal/LegalBrandingNotice";

export const metadata: Metadata = {
  applicationName: "Seraph Nexus",
  other: {
    copyright: "2026 SeraphCore. All rights reserved.",
  },
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const requestHeaders = await headers();
  const currentPath = requestHeaders.get("x-current-path") || "";
  const hideGlobalHeader =
    currentPath === "/login" ||
    currentPath === "/signup" ||
    currentPath === "/forgot-password" ||
    currentPath === "/reset-password" ||
    currentPath.startsWith("/auth/");
  const hideGlobalFooter =
    currentPath.startsWith("/admin") ||
    currentPath.startsWith("/dashboard") ||
    currentPath.startsWith("/platform-admin");

  return (
    <html lang="en">
      <body>
        <div className="app-root-shell flex flex-col bg-[var(--page-bg)] text-[var(--text-main)]">
          {!hideGlobalHeader ? <Navbar /> : null}
          <div className="flex-1">{children}</div>
          {!hideGlobalFooter ? (
            <footer className="site-legal-footer">
              <div className="public-container">
                <LegalBrandingNotice />
              </div>
            </footer>
          ) : null}
        </div>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
