import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { isOrderBusinessType } from "@/lib/businessModules";
import { getPlanLimit } from "@/lib/planConfig";
import { createAdminTranslator } from "@/lib/adminI18n";
import AdminProductsManager from "@/components/AdminProductsManager";

export default async function ProductsPage() {
  const supabase = await createClient();
  const business = await getActiveBusiness();
  const isDev = process.env.NODE_ENV !== "production";
  const maxProducts = business ? getPlanLimit(business.plan, "max_products") : null;

  if (!business) {
    return <div className="text-white">{createAdminTranslator(null)("noActiveBusiness")}</div>;
  }

  const t = createAdminTranslator(business.language);

  if (!isOrderBusinessType(business.business_type)) {
    return (
      <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-6 text-white">
        {t("products")} and {t("menu").toLowerCase()} management is only available for order-based businesses.
      </div>
    );
  }

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("business_id", business.id)
    .order("name", { ascending: true });

  if (isDev) {
    console.log("[admin/products] business_type:", business.business_type || null);
    console.log("[admin/products] item count:", products?.length || 0);
  }

  return (
    <div className="space-y-6">
      {maxProducts !== null ? (
        <div className="rounded-xl border border-[rgba(212,175,55,0.18)] bg-[rgba(212,175,55,0.08)] px-4 py-3 text-sm text-[var(--accent-gold-soft)]">
          Trial workspaces can save up to {maxProducts} products. Upgrade to Pro or Elite for an
          unlimited catalog.
        </div>
      ) : null}

      <AdminProductsManager
        businessId={business.id}
        businessType={business.business_type}
        language={business.language}
        initialProducts={products || []}
      />
    </div>
  );
}
