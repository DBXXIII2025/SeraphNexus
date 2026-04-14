import { createAdminClient } from "@/lib/supabase/server";

export type BusinessStaffMember = {
  id: string;
  business_id: string;
  owner_id: string;
  email: string;
  role: "staff" | "manager" | "admin";
  status: "active" | "inactive";
  created_at: string | null;
};

export async function loadBusinessStaffMembers(businessId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("business_staff_members")
    .select("id,business_id,owner_id,email,role,status,created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error) {
    return {
      members: [] as BusinessStaffMember[],
      error:
        error.code === "42P01" || error.code === "42703"
          ? "Staff-role storage is not installed yet. Apply the business staff migration."
          : error.message,
    };
  }

  return {
    members: (data || []) as BusinessStaffMember[],
    error: null,
  };
}
