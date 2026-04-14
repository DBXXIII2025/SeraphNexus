import { createAdminClient } from "@/lib/supabase/server";

export type BusinessStaffRole = "staff" | "manager" | "admin";

export type BusinessStaffMember = {
  id: string;
  business_id: string;
  user_id: string;
  email: string;
  role: BusinessStaffRole;
  status: "active" | "inactive";
  created_at: string | null;
};

type BusinessStaffRow = {
  id: string;
  business_id: string;
  user_id: string;
  role: BusinessStaffRole | string | null;
  created_at: string | null;
};

function normalizeStaffRole(role: unknown): BusinessStaffRole {
  return role === "admin" || role === "manager" || role === "staff" ? role : "staff";
}

export async function getBusinessStaffRole(args: {
  businessId: string;
  userId: string;
}): Promise<BusinessStaffRole | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("business_staff_members")
    .select("role")
    .eq("business_id", args.businessId)
    .eq("user_id", args.userId)
    .limit(1);

  if (error) {
    if (error.code !== "42P01" && error.code !== "42703") {
      console.error("[businessStaff] role lookup failed", {
        businessId: args.businessId,
        userId: args.userId,
        message: error.message,
      });
    }
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return row ? normalizeStaffRole(row.role) : null;
}

export async function getStaffBusinessIdsForUser(userId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("business_staff_members")
    .select("business_id")
    .eq("user_id", userId);

  if (error) {
    if (error.code !== "42P01" && error.code !== "42703") {
      console.error("[businessStaff] business list lookup failed", {
        userId,
        message: error.message,
      });
    }
    return [];
  }

  return Array.from(
    new Set((data || []).map((row) => String(row.business_id || "")).filter(Boolean))
  );
}

export async function resolveProfileIdByEmail(email: string) {
  const supabase = createAdminClient();
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id,email")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    console.error("[businessStaff] profile lookup failed", {
      email: normalizedEmail,
      message: error.message,
    });
    return null;
  }

  return data?.id ? String(data.id) : null;
}

export async function loadBusinessStaffMembers(businessId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("business_staff_members")
    .select("id,business_id,user_id,role,created_at")
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

  const rows = (data || []) as BusinessStaffRow[];
  const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)));
  const profileEmails = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id,email")
      .in("id", userIds);

    if (profilesError) {
      console.error("[businessStaff] profile email lookup failed", {
        businessId,
        message: profilesError.message,
      });
    } else {
      for (const profile of profiles || []) {
        if (profile.id && profile.email) {
          profileEmails.set(String(profile.id), String(profile.email));
        }
      }
    }
  }

  return {
    members: rows.map((row) => ({
      id: row.id,
      business_id: row.business_id,
      user_id: row.user_id,
      email: profileEmails.get(row.user_id) || row.user_id,
      role: normalizeStaffRole(row.role),
      status: "active",
      created_at: row.created_at,
    })) satisfies BusinessStaffMember[],
    error: null,
  };
}
