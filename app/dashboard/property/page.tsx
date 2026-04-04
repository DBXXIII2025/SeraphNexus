import { getBusiness } from "@/lib/auth/getBusiness";

export default async function PropertyPage() {
  try {
    const { supabase, businessId } = await getBusiness();

    const propertyTable = supabase.from("property") as any;

    const { data: properties, error } = await propertyTable
      .select("*")
      .eq("business_id", businessId);

    if (error) {
      return <div>Error loading properties</div>;
    }

    return (
      <div>
        <h1 className="text-2xl mb-4">Properties</h1>

        {(properties?.length ?? 0) === 0 && <p>No properties found.</p>}

        <ul className="space-y-2">
          {properties?.map((p: any) => (
            <li key={p.id} className="border p-2">
              <p><strong>Name:</strong> {p.name}</p>
              <p><strong>Price:</strong> ${p.price}</p>
            </li>
          ))}
        </ul>
      </div>
    );
  } catch (err: any) {
    return <div>{err.message}</div>;
  }
}
