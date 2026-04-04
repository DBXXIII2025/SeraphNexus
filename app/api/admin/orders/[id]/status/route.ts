import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, logRouteError } from "@/lib/apiErrors";

const ALLOWED_STATUSES = new Set([
  "preparing",
  "ready",
  "completed",
  "fulfilled",
  "canceled",
]);

type OrdersTable = {
  select: (query: string) => {
    eq: (column: string, value: string) => {
      maybeSingle: () => Promise<{
        data: { id?: string | null; business_id?: string | null; status?: string | null } | null;
      }>;
    };
  };
  update: (payload: Record<string, unknown>) => {
    eq: (column: string, value: string) => {
      eq: (column2: string, value2: string) => Promise<{
        error: { message: string } | null;
      }>;
    };
  };
};

type BusinessesTable = {
  select: (query: string) => {
    eq: (column: string, value: string) => {
      eq: (column2: string, value2: string) => {
        maybeSingle: () => Promise<{ data: { id?: string | null } | null }>;
      };
    };
  };
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const formData = await req.formData();
  const status = String(formData.get("status") || "");

  if (!id || !ALLOWED_STATUSES.has(status)) {
    return NextResponse.redirect(new URL("/admin/orders", req.url));
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const ordersTable = supabase.from("orders") as unknown as OrdersTable;
  const businessesTable = supabase.from("businesses") as unknown as BusinessesTable;

  const { data: order } = await ordersTable
    .select("id, business_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!order?.business_id) {
    return NextResponse.redirect(new URL("/admin/orders", req.url));
  }

  const { data: business } = await businessesTable
    .select("id")
    .eq("id", order.business_id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!business) {
    return NextResponse.redirect(new URL("/admin/orders", req.url));
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[admin/orders/status] update:", {
      orderId: id,
      businessId: business.id,
      previousStatus: order.status || null,
      status,
    });
  }

  const { error: updateError } = await ordersTable
    .update({ status })
    .eq("id", id)
    .eq("business_id", business.id);

  if (updateError) {
    logRouteError("admin/orders/status", {
      step: "order.update",
      code: "ADMIN_ORDER_STATUS_UPDATE_FAILED",
      message: updateError.message,
      status: 500,
      error: updateError,
      extra: {
        orderId: id,
        businessId: business.id,
        status,
      },
    });
    return errorResponse({
      status: 500,
      error: "We couldn't update this order status.",
      code: "ADMIN_ORDER_STATUS_UPDATE_FAILED",
      step: "order.update",
    });
  }

  return NextResponse.redirect(new URL("/admin/orders", req.url));
}
