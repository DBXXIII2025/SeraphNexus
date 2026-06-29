import "./globals.css";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Navbar from "@/components/navigation/Navbar";
import LegalBrandingNotice from "@/components/legal/LegalBrandingNotice";

export const metadata: Metadata = {
  title: {
    default: "Seraph Nexus | Business operations and checkout platform",
    template: "%s | Seraph Nexus",
  },
  description:
    "Run bookings, services, rentals, products, orders, promotions, customer messages, and checkout from one business workspace.",
  applicationName: "Seraph Nexus",
  metadataBase: new URL("https://seraphnexus.com"),
  openGraph: {
    type: "website",
    siteName: "Seraph Nexus",
    title: "Seraph Nexus",
    description:
      "A business operations platform for bookings, commerce, customer activity, and Stripe-powered checkout.",
    url: "https://seraphnexus.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "Seraph Nexus",
    description:
      "Manage services, rentals, products, orders, promotions, leads, messages, and checkout from one workspace.",
  },
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
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <div className="app-root-shell flex flex-col bg-[var(--page-bg)] text-[var(--text-main)]">
          {!hideGlobalHeader ? <Navbar /> : null}
          <main id="main-content" className="flex-1" tabIndex={-1}>
            {children}
          </main>
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
