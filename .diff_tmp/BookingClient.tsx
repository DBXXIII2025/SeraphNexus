"use client";

import { useEffect, useState } from "react";

type Slot = {
  start: string;
  end: string;
  price: number;
  demand_score: number;
};

export default function BookingClient({
  business,
  isOwner,
}: {
  business: any;
  isOwner: boolean;
}) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availabilityConfigured, setAvailabilityConfigured] = useState(true);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const fetchSlots = async (date: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/availability?businessId=${business.id}&date=${date}&tz=${encodeURIComponent(
          timezone
        )}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      setSlots(data.slots || []);
      setAvailabilityConfigured(data.availabilityConfigured !== false);
    } catch (err: any) {
      setError(err?.message || "Failed to load slots");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBooking = async (slot: Slot) => {
    setError(null);

    if (!email) {
      setError("Please enter your email to continue");
      return;
    }

    try {
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          business_id: business.id,
          date: selectedDate,
          start_time: slot.start,
          end_time: slot.end,
          customer_email: email,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Failed to start checkout");
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        setError("Stripe checkout URL was not returned");
      }
    } catch (err: any) {
      setError(err?.message || "Unexpected error while booking");
    }
  };

  useEffect(() => {
    if (!selectedDate) return;
    fetchSlots(selectedDate);
  }, [selectedDate]);

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl mb-2">{business.name}</h1>

      <p className="text-sm text-gray-400 mb-4">
        Your timezone: {timezone}
      </p>

      <div className="mb-4">
        <label className="block text-sm text-gray-300 mb-1">Email</label>
        <input
          type="email"
          className="text-black p-2 w-full"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm text-gray-300 mb-1">Date</label>
        <input
          type="date"
          className="text-black p-2"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      {error && <p className="text-red-400 mb-4">{error}</p>}

      {isLoading && <p>Loading available slots...</p>}

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-2">
        {!isLoading && slots.length === 0 && selectedDate && (
          <div className="text-sm text-gray-300">
            {availabilityConfigured ? (
              <p>No available slots.</p>
            ) : (
              <div>
                <p>No availability set yet.</p>
                {isOwner && (
                  <a
                    href="/admin/calendar"
                    className="text-purple-300 underline"
                  >
                    Set availability in your admin calendar
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {slots.map((slot, i) => {
          const isHighDemand = slot.demand_score >= 70;
          const isDiscounted = slot.demand_score <= 30;

          return (
            <button
              key={i}
              onClick={() => handleBooking(slot)}
              className="bg-blue-600 p-3 rounded hover:bg-blue-700 text-left"
            >
              <div className="font-semibold">
                {slot.start} - {slot.end}
              </div>
              <div className="text-sm">${slot.price.toFixed(2)}</div>
              <div className="text-xs text-gray-200 mt-1">
                Demand: {slot.demand_score}
              </div>
              {isHighDemand && (
                <div className="text-xs text-orange-300 mt-1">
                  {"\uD83D\uDD25"} High demand
                </div>
              )}
              {isDiscounted && (
                <div className="text-xs text-green-300 mt-1">
                  {"\uD83D\uDCB8"} Discounted slot
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
