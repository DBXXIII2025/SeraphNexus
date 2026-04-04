import { getBusiness } from "@/lib/auth/getBusiness";

export default async function DescriptionsPage() {
  try {
    const { supabase, businessId } = await getBusiness();

    const contentTable = supabase.from("property_content") as any;

    const { data: content, error } = await contentTable
      .select("*")
      .eq("business_id", businessId)
      .single();

    if (error || !content) {
      return <div>No description found</div>;
    }

    return (
      <div>
        <h1 className="text-2xl mb-4">Description</h1>
        <div className="border p-4">
          <h2 className="text-xl">{content.title}</h2>
          <p>{content.description}</p>
        </div>
      </div>
    );
  } catch (err: any) {
    return <div>{err.message}</div>;
  }
}
