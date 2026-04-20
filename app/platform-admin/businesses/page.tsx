import { redirect } from "next/navigation";

export default function LegacyPlatformAdminBusinessesPage() {
  console.info("[platform-admin] legacy route redirected", {
    from: "/platform-admin/businesses",
    to: "/admin/businesses",
  });
  redirect("/admin/businesses");
}
