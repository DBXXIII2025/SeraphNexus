import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { isOrderBusinessType } from "@/lib/businessModules";
import AdminProductsManager from "@/components/AdminProductsManager";

export default async function ProductsPage() {
  const supabase = await createClient();
  const business = await getActiveBusiness();
  const isDev = process.env.NODE_ENV !== "production";

  if (!business) {
    return <div className="text-white">No active business</div>;
  }

  if (!isOrderBusinessType(business.business_type)) {
    return (
      <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-6 text-white">
        Product and menu management is only available for order-based businesses.
      </div>
    );
  }

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("business_id", business.id);

  if (isDev) {
    console.log("[admin/products] business_type:", business.business_type || null);
    console.log("[admin/products] item count:", products?.length || 0);
  }

  return (
    <AdminProductsManager
      businessId={business.id}
      businessType={business.business_type}
      initialProducts={products || []}
    />
  );
}
