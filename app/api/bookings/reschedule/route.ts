import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendBookingEmail, sendBookingSMS } from "@/lib/notify";
import { errorResponse, getErrorMessage, logRouteError } from "@/lib/apiErrors";

const OPEN_HOUR = 9;
const CLOSE_HOUR = 17;

function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map((v) => Number(v));
  return h * 60 + (m || 0);
}

function minutesToTime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return `${hh}:${mm}`;
}

function overlaps(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && endA > startB;
}

function toDateString(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

type BookingTimeRow = {
  start_time: string | null;
  end_time: string | null;
  date?: string | null;
};

export async function POST(req: Request) {
  let step = "request.validate";

  try {
    const formData = await req.formData();

    const id = String(formData.get("id") || "");
    const new_time = String(formData.get("new_time") || "");

    if (!id || !new_time) {
      return errorResponse({
        status: 400,
        error: "Booking ID and a new time are required to reschedule.",
        code: "BOOKING_RESCHEDULE_FIELDS_REQUIRED",
        step,
      });
    }

    const parsedLocal = new Date(new_time);

    if (isNaN(parsedLocal.getTime())) {
      return errorResponse({
        status: 400,
        error: "Enter a valid reschedule time.",
        code: "BOOKING_RESCHEDULE_TIME_INVALID",
        step,
      });
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const { data: booking } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", id)
      .single();

    if (!booking) {
      return errorResponse({
        status: 404,
        error: "This booking could not be found.",
        code: "BOOKING_RESCHEDULE_NOT_FOUND",
        step: "booking.read",
      });
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("id", booking.business_id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!business?.id) {
      return errorResponse({
        status: 403,
        error: "You do not have access to reschedule this booking.",
        code: "BOOKING_RESCHEDULE_FORBIDDEN",
        step: "auth.business_scope",
      });
    }

    const localHour = parsedLocal.getHours();

    if (localHour < OPEN_HOUR || localHour >= CLOSE_HOUR) {
      return errorResponse({
        status: 400,
        error: "Choose a time during business hours.",
        code: "BOOKING_RESCHEDULE_OUTSIDE_HOURS",
        step: "slot.validate",
      });
    }

    const newDate = toDateString(parsedLocal);
    const newStartMinutes = parsedLocal.getHours() * 60 + parsedLocal.getMinutes();

    let durationMinutes = 30;
    if (booking.start_time && booking.end_time) {
      durationMinutes = Math.max(
        15,
        timeToMinutes(booking.end_time) - timeToMinutes(booking.start_time)
      );
    }

    const newEndMinutes = newStartMinutes + durationMinutes;
    const newStart = minutesToTime(newStartMinutes);
    const newEnd = minutesToTime(newEndMinutes);

    const { data: others } = await supabase
      .from("bookings")
      .select("start_time, end_time, date")
      .eq("business_id", business.id)
      .eq("date", newDate)
      .neq("id", id)
      .neq("status", "cancelled");

    const conflict = ((others || []) as BookingTimeRow[]).some((b) => {
      if (!b.start_time || !b.end_time) return false;
      return overlaps(newStartMinutes, newEndMinutes, timeToMinutes(b.start_time), timeToMinutes(b.end_time));
    });

    if (conflict) {
      return errorResponse({
        status: 400,
        error: "That time slot is already booked.",
        code: "BOOKING_RESCHEDULE_SLOT_UNAVAILABLE",
        step: "slot.validate",
      });
    }

    step = "booking.update";
    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        date: newDate,
        start_time: newStart,
        end_time: newEnd,
      })
      .eq("id", id)
      .eq("business_id", business.id);

    if (updateError) {
      logRouteError("bookings/reschedule", {
        step,
        code: "BOOKING_RESCHEDULE_UPDATE_FAILED",
        message: updateError.message,
        status: 400,
        error: updateError,
        extra: { bookingId: id, newDate, newStart, newEnd },
      });

      return errorResponse({
        status: 400,
        error: "We couldn't reschedule this booking.",
        code: "BOOKING_RESCHEDULE_UPDATE_FAILED",
        step,
      });
    }

    await sendBookingEmail({
      to: booking.customer_email,
      subject: "Booking Rescheduled",
      message: `New time: ${newDate} ${newStart} - ${newEnd}`,
    });

    if (booking.phone) {
      await sendBookingSMS({
        to: booking.phone,
        message: "Your booking has been rescheduled.",
      });
    }

    return NextResponse.redirect(new URL("/admin/bookings", req.url));
  } catch (err: unknown) {
    logRouteError("bookings/reschedule", {
      step,
      code: "BOOKING_RESCHEDULE_FAILED",
      message: getErrorMessage(err, "Booking reschedule failed"),
      status: 500,
      error: err,
    });

    return errorResponse({
      status: 500,
      error: "We couldn't reschedule this booking right now.",
      code: "BOOKING_RESCHEDULE_FAILED",
      step,
    });
  }
}
