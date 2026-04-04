import { createClient } from "@/lib/supabase/server";

export default async function AdminDescriptionsPage() {
  try {
    // ✅ FIX: await client
    const supabase = await createClient();

    // 1. Get user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return <div>Unauthorized</div>;
    }

    // 🔥 FORCE TABLE TYPES
    const businessesTable = supabase.from("businesses") as any;
    const contentTable = supabase.from("property_content") as any;

    // 2. Get business
    const { data: businessData } = await businessesTable
      .select("id")
      .eq("owner_id", user.id)
      .single();

    const business = businessData as { id: string } | null;

    if (!business) {
      return <div>No business found</div>;
    }

    // 3. Get content
    const { data: content, error } = await contentTable
      .select("*")
      .eq("business_id", business.id)
      .single();

    if (error || !content) {
      return <div>No content found</div>;
    }

    return (
      <div>
        <h1 className="text-2xl mb-4">Descriptions</h1>

        <div className="border p-4">
          <h2 className="text-xl font-semibold">{content.title}</h2>
          <p className="mt-2">{content.description}</p>
        </div>
      </div>
    );
  } catch (err: any) {
    return <div>{err.message}</div>;
  }
}
