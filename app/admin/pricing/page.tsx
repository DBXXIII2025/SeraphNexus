import { createClient } from "@/lib/supabase/server";
import {
  PLAN_DEFINITIONS,
  getPlanDefinition,
  getPlatformFeeLabel,
} from "@/lib/planConfig";

export default async function PricingAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return <div>Unauthorized</div>;
  }

  const { data: businessData } = await supabase
    .from("businesses")
    .select("id, name, plan")
    .eq("owner_id", user.id)
    .single();

  if (!businessData) {
    return <div>No business found</div>;
  }

  const plan = getPlanDefinition(businessData.plan);

  return (
    <div>
      <h1 className="mb-4 text-2xl">Pricing</h1>

      <div className="border p-4">
        <p>
          <strong>Business:</strong> {businessData.name}
        </p>
        <p>
          <strong>Current Plan:</strong> {plan.label}
        </p>
        <p>
          <strong>Current Platform Fee:</strong> {getPlatformFeeLabel(plan.tier)}
        </p>
      </div>

      <div className="mt-4 border p-4">
        <h2 className="mb-2 font-semibold">Plans</h2>

        <ul className="space-y-2">
          {Object.values(PLAN_DEFINITIONS).map((definition) => (
            <li key={definition.tier} className="border p-2">
              <strong>{definition.label}</strong> - {definition.monthlyPriceLabel} -{" "}
              {getPlatformFeeLabel(definition.tier)} platform fee
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
