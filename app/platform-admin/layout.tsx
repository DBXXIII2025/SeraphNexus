import type { ReactNode } from "react";
import { requirePlatformAdminPage } from "@/lib/platformAdmin";

export default async function PlatformAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePlatformAdminPage();
  return children;
}
