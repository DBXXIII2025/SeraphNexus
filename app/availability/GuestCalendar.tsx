"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";

type Booking = {
  date: string;
  start_time: string;
  end_time: string;
};

export default function GuestCalendar({ bookings }: { bookings: Booking[] }) {
  const events = bookings.map((b) => ({
    start: `${b.date}T${b.start_time}`,
    end: `${b.date}T${b.end_time}`,
    display: "background",
    backgroundColor: "#fecaca",
  }));

  return (
    <div className="p-8">
      <FullCalendar
        plugins={[dayGridPlugin]}
        initialView="dayGridMonth"
        events={events}
      />
    </div>
  );
}
