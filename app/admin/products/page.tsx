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
    return <div className="text-[var(--text-main)]">{createAdminTranslator(null)("noActiveBusiness")}</div>;
  }

  const t = createAdminTranslator(business.language);

  if (!isOrderBusinessType(business.business_type)) {
    return (
      <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-6 text-[var(--text-main)]">
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
        <div className="rounded-xl border border-[var(--accent-border)] bg-[var(--accent-muted)] px-4 py-3 text-sm text-[var(--accent-soft)]">
          Starter Access workspaces can save up to {maxProducts} products. Upgrade to Pro for 50
          items or Elite for unlimited catalog depth.
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
