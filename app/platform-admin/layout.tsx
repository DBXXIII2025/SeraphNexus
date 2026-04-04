import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { requirePlatformAdminPage } from "@/lib/platformAdmin";

export default async function PlatformAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePlatformAdminPage();
  void children;
  redirect("/admin/dashboard");
}
