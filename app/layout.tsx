import "./globals.css";
import type { ReactNode } from "react";
import Navbar from "@/components/navigation/Navbar";

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)]">
          <Navbar />
          {children}
        </div>
      </body>
    </html>
  );
}
