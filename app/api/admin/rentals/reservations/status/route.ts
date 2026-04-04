import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, logRouteError } from "@/lib/apiErrors";

const ALLOWED_STATUSES = new Set(["confirmed", "completed", "cancelled"]);

type ReservationsTable = {
  select: (query: string) => {
    eq: (column: string, value: string) => {
      maybeSingle: () => Promise<{
        data:
          | {
              id?: string | null;
              business_id?: string | null;
              status?: string | null;
            }
          | null;
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

export async function POST(req: Request) {
  const supabase = await createClient();
  const formData = await req.formData();
  const reservationId = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");

  if (!reservationId || !ALLOWED_STATUSES.has(status)) {
    return NextResponse.redirect(new URL("/admin/bookings", req.url));
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const reservationsTable = supabase.from("rental_reservations") as unknown as ReservationsTable;
  const businessesTable = supabase.from("businesses") as unknown as BusinessesTable;

  const { data: reservation } = await reservationsTable
    .select("id, business_id, status")
    .eq("id", reservationId)
    .maybeSingle();

  if (!reservation?.business_id) {
    return NextResponse.redirect(new URL("/admin/bookings", req.url));
  }

  const { data: business } = await businessesTable
    .select("id")
    .eq("id", reservation.business_id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!business?.id) {
    return NextResponse.redirect(new URL("/admin/bookings", req.url));
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[admin/rentals/reservations/status] update", {
      reservationId,
      businessId: business.id,
      previousStatus: reservation.status || null,
      status,
    });
  }

  const { error: updateError } = await reservationsTable
    .update({ status })
    .eq("id", reservationId)
    .eq("business_id", business.id);

  if (updateError) {
    logRouteError("admin/rentals/reservations/status", {
      step: "reservation.update",
      code: "ADMIN_RENTAL_RESERVATION_STATUS_UPDATE_FAILED",
      message: updateError.message,
      status: 500,
      error: updateError,
      extra: {
        reservationId,
        businessId: business.id,
        status,
      },
    });

    return errorResponse({
      status: 500,
      error: "We couldn't update this reservation status.",
      code: "ADMIN_RENTAL_RESERVATION_STATUS_UPDATE_FAILED",
      step: "reservation.update",
    });
  }

  return NextResponse.redirect(new URL("/admin/bookings", req.url));
}
