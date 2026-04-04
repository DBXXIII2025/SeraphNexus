import { createClient } from "@/lib/supabase/server";

type BookingRecord = Record<string, unknown> & {
  id?: string | null;
  business_id?: string | null;
};

type BookingsTable = {
  select: (query: string) => {
    eq: (column: string, value: string) => {
      maybeSingle: () => Promise<{ data: BookingRecord | null }>;
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

export async function getOwnedBookingContext(bookingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      supabase,
      user: null,
      booking: null,
      businessId: null,
      authorized: false,
      shouldLogin: true,
    };
  }

  const bookingsTable = supabase.from("bookings") as unknown as BookingsTable;
  const businessesTable = supabase.from("businesses") as unknown as BusinessesTable;

  const { data: booking } = await bookingsTable
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking?.business_id) {
    return {
      supabase,
      user,
      booking: null,
      businessId: null,
      authorized: false,
      shouldLogin: false,
    };
  }

  const { data: business } = await businessesTable
    .select("id")
    .eq("id", booking.business_id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!business?.id) {
    return {
      supabase,
      user,
      booking: booking as BookingRecord,
      businessId: null,
      authorized: false,
      shouldLogin: false,
    };
  }

  return {
    supabase,
    user,
    booking: booking as BookingRecord,
    businessId: String(business.id),
    authorized: true,
    shouldLogin: false,
  };
}
