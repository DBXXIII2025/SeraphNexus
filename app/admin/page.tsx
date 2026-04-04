import { redirect } from "next/navigation";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { getPlatformAdminSession } from "@/lib/platformAdmin";
import { getTenantAdminHomeRoute } from "@/lib/tenantRouting";

export default async function AdminPage() {
  const { user, isPlatformAdmin } = await getPlatformAdminSession();

  if (isPlatformAdmin) {
    redirect("/admin/dashboard");
  }

  if (!user?.id) {
    redirect("/login?next=%2Fadmin");
  }

  const business = await getActiveBusiness();

  if (!business) {
    redirect("/onboarding");
  }

  const route = await getTenantAdminHomeRoute({
    business,
    userId: user.id,
  });

  redirect(route);
}
