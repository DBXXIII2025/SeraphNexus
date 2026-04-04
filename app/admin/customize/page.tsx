import { redirect } from "next/navigation";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { getBusinessProfileCompletion } from "@/lib/businessProfileCompletion";
import { getPlatformAdminSession } from "@/lib/platformAdmin";
import CustomizeClient from "./CustomizeClient";

export default async function CustomizePage() {
  const { isPlatformAdmin } = await getPlatformAdminSession();

  if (isPlatformAdmin) {
    redirect("/admin/platform");
  }

  const business = await getActiveBusiness();

  if (!business) {
    return <div className="text-white">No active business</div>;
  }

  const profileCompletion = getBusinessProfileCompletion(business);

  return (
    <CustomizeClient
      initialBusiness={{
        id: business.id,
        name: business.name || "",
        slug: business.slug || "",
        description: business.description || "",
        business_type: business.business_type || "service",
      }}
      initialCompletion={profileCompletion}
    />
  );
}
