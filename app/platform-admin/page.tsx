import { redirect } from "next/navigation";

export default function LegacyPlatformAdminPage() {
  console.info("[platform-admin] legacy route redirected", {
    from: "/platform-admin",
    to: "/admin",
  });
  redirect("/admin");
}
