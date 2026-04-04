"use client";

import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import {
  getBookingDisplayRange,
  getReservationGuestLabel,
} from "@/lib/rentalAvailability";

type CalendarProperty = {
  id: string;
  name: string | null;
  price?: number | null;
  description?: string | null;
} | null;

type ReservationLike = {
  id: string;
  property_id?: string | null;
  guest_name?: string | null;
  guest_email?: string | null;
  guest_phone?: string | null;
  check_in_date?: string | null;
  check_out_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  status?: string | null;
  payment_status?: string | null;
};

type BlockLike = {
  id: string;
  property_id: string | null;
  start_date: string | null;
  end_date: string | null;
  reason: string | null;
};

type Props = {
  selectedProperty: CalendarProperty;
  propertyCount: number;
  reservations: ReservationLike[];
  blocks: BlockLike[];
  propertyNameById: Map<string, string>;
};

function getExclusiveEnd(date: string | null) {
  if (!date) {
    return undefined;
  }

  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + 1);
  return next.toISOString().slice(0, 10);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(`${value}T00:00:00`));
}

export default function RentalsCalendarPanel({
  selectedProperty,
  propertyCount,
  reservations,
  blocks,
  propertyNameById,
}: Props) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const events = useMemo(
    () => [
      ...blocks.map((block) => ({
        id: `block-${block.id}`,
        title: block.reason || "Blocked",
        start: block.start_date || undefined,
        end: getExclusiveEnd(block.end_date || block.start_date || null),
        allDay: true,
        classNames: ["calendar-event-blocked"],
      })),
      ...reservations.flatMap((reservation) => {
        const displayRange = getBookingDisplayRange(reservation);
        if (!displayRange) {
          return [];
        }

        return [
          {
            id: `reservation-${reservation.id}`,
            title: getReservationGuestLabel(reservation),
            start: displayRange.startDate,
            end: getExclusiveEnd(displayRange.endDate),
            allDay: true,
            classNames: [
              reservation.status === "confirmed"
                ? "calendar-event-confirmed"
                : "calendar-event-booked",
              reservation.status === "pending" ? "calendar-event-pending" : "",
            ].filter(Boolean),
          },
        ];
      }),
    ],
    [blocks, reservations]
  );

  const selectedDateReservations = selectedDate
    ? reservations.filter((reservation) => {
        const displayRange = getBookingDisplayRange(reservation);
        const start = displayRange?.startDate || "";
        const end = displayRange?.endDate || displayRange?.startDate || "";
        return start <= selectedDate && end >= selectedDate;
      })
    : [];

  const selectedDateBlocks = selectedDate
    ? blocks.filter((block) => {
        const start = block.start_date || "";
        const end = block.end_date || block.start_date || "";
        return start <= selectedDate && end >= selectedDate;
      })
    : [];

  return (
    <div className="surface-card p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="section-kicker">Availability Grid</p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
            Premium availability calendar
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-soft)]">
            {selectedProperty
              ? `Focused on ${selectedProperty.name || "the selected listing"} with blocked ranges and reservation pressure visible in one operational surface.`
              : propertyCount > 1
                ? "Select a listing to focus the calendar on one inventory record and avoid mixed availability signals."
                : "Calendar activity will appear here once listings, blocks, or reservations are present."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(193,18,31,0.22)] bg-[rgba(193,18,31,0.1)] px-3 py-1 text-[var(--accent-soft)]">
            <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
            Blocked
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(212,175,55,0.22)] bg-[rgba(212,175,55,0.08)] px-3 py-1 text-[var(--accent-gold-soft)]">
            <span className="h-2 w-2 rounded-full bg-[var(--accent-gold)]" />
            Reservations
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(232,204,106,0.28)] bg-[rgba(232,204,106,0.1)] px-3 py-1 text-[var(--accent-gold-soft)]">
            <span className="h-2 w-2 rounded-full bg-[var(--accent-gold-soft)]" />
            Selected day
          </span>
        </div>
      </div>

      {!selectedProperty && propertyCount > 1 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[var(--border-soft)] bg-[rgba(15,12,12,0.68)] px-4 py-10 text-sm text-[var(--text-soft)]">
          Choose a listing from the selector to activate the calendar view.
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="fullcalendar-shell rounded-2xl border border-[var(--border-soft)] bg-[rgba(15,12,12,0.52)] p-4">
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              height="auto"
              events={events}
              selectable
              selectMirror={false}
              dayMaxEventRows={3}
              dateClick={(info) => setSelectedDate(info.dateStr)}
              dayCellClassNames={(arg) =>
                selectedDate && arg.dateStr === selectedDate ? ["fc-day-selected"] : []
              }
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "",
              }}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(15,12,12,0.52)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Selected Day
              </p>
              <p className="mt-2 text-lg font-semibold text-[var(--accent-gold-soft)]">
                {selectedDate ? formatDate(selectedDate) : "Select a date"}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                Click any date to inspect reservation overlap and blocked availability for the
                current listing.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-[rgba(193,18,31,0.18)] bg-[rgba(193,18,31,0.08)] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  Blocked on day
                </p>
                <p className="mt-2 text-2xl font-semibold text-[var(--accent-soft)]">
                  {selectedDateBlocks.length}
                </p>
              </div>
              <div className="rounded-2xl border border-[rgba(212,175,55,0.18)] bg-[rgba(212,175,55,0.08)] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  Reservations on day
                </p>
                <p className="mt-2 text-2xl font-semibold text-[var(--accent-gold-soft)]">
                  {selectedDateReservations.length}
                </p>
              </div>
            </div>
          </div>

          {selectedDate ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(15,12,12,0.52)] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  Blocks on selected day
                </p>
                {selectedDateBlocks.length === 0 ? (
                  <p className="mt-3 text-sm text-[var(--text-soft)]">No blocked windows.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {selectedDateBlocks.map((block) => (
                      <div
                        key={block.id}
                        className="rounded-2xl border border-[rgba(193,18,31,0.18)] bg-[rgba(193,18,31,0.08)] px-4 py-3"
                      >
                        <p className="font-medium text-[var(--text-strong)]">
                          {propertyNameById.get(String(block.property_id)) || "Listing"}
                        </p>
                        <p className="mt-1 text-sm text-[var(--text-soft)]">
                          {formatDate(block.start_date)} to {formatDate(block.end_date || block.start_date)}
                        </p>
                        {block.reason ? (
                          <p className="mt-2 text-sm text-[var(--text-soft)]">{block.reason}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(15,12,12,0.52)] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  Reservations on selected day
                </p>
                {selectedDateReservations.length === 0 ? (
                  <p className="mt-3 text-sm text-[var(--text-soft)]">No reservations overlap this date.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {selectedDateReservations.map((reservation) => {
                      const displayRange = getBookingDisplayRange(reservation);

                      return (
                        <div
                          key={reservation.id}
                          className="rounded-2xl border border-[rgba(212,175,55,0.18)] bg-[rgba(212,175,55,0.08)] px-4 py-3"
                        >
                          <p className="font-medium text-[var(--text-strong)]">
                            {getReservationGuestLabel(reservation)}
                          </p>
                          <p className="mt-1 text-sm text-[var(--text-soft)]">
                            {formatDate(displayRange?.startDate || null)} to {formatDate(
                              displayRange?.endDate || displayRange?.startDate || null
                            )}
                          </p>
                          <p className="mt-2 text-sm text-[var(--text-soft)]">
                            {reservation.guest_email || "No email"}{" "}
                            {reservation.guest_phone ? `| ${reservation.guest_phone}` : ""}
                          </p>
                          <p className="mt-2 text-sm text-[var(--text-soft)]">
                            {reservation.status || "pending"} reservation for{" "}
                            {propertyNameById.get(String(reservation.property_id)) || "listing"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
