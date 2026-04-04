"use client";

import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";

type Booking = {
  id: string;
  customer_email: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
};

export default function CalendarClient({
  bookings,
}: {
  bookings: Booking[];
}) {
  const router = useRouter();

  const statusColor = (status: string) => {
    if (status === "confirmed") return "#22c55e"; // green
    if (status === "pending") return "#eab308";   // yellow
    if (status === "cancelled") return "#ef4444"; // red
    return "#6b7280"; // gray (fallback)
  };

  return (
    <main className="min-h-screen bg-black text-rosepink p-8">
      <h1 className="text-2xl mb-6">Booking Calendar</h1>

      <div className="bg-black border border-rosepink rounded p-4">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          height="auto"

          events={bookings.map((b) => ({
            id: b.id,
            title: b.customer_email || "Booking",
            start: `${b.date}T${b.start_time}`,
            end: `${b.date}T${b.end_time}`,
            backgroundColor: statusColor(b.status),
            borderColor: statusColor(b.status),
            textColor: "#000000",
          }))}

          eventClick={(info) => {
            router.push(`/admin/bookings?focus=${info.event.id}`);
          }}

          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "",
          }}

          dayMaxEventRows={3}
          eventDisplay="block"
        />
      </div>
    </main>
  );
}
