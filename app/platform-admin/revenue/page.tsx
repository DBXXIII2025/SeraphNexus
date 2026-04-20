import { redirect } from "next/navigation";

export default function LegacyPlatformAdminRevenuePage() {
  console.info("[platform-admin] legacy route redirected", {
    from: "/platform-admin/revenue",
    to: "/admin/revenue",
  });
  redirect("/admin/revenue");
}
