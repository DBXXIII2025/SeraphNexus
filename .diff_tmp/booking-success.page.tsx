"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Booking = {
  id: string;
  status: string;
  date: string;
  start_time: string;
  end_time: string;
  customer_email: string;
};

export default function BookingSuccess() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      try {
        const res = await fetch(
          `/api/stripe/booking-status?session_id=${sessionId}`,
          { cache: "no-store" }
        );

        const data = await res.json();

        if (!cancelled && data?.booking) {
          setBooking(data.booking);
          setIsLoading(false);
          return;
        }

        if (!cancelled && attempts < 8) {
          setTimeout(poll, 2000);
        } else if (!cancelled) {
          setIsLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to confirm booking");
          setIsLoading(false);
        }
      }
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (!sessionId) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <h1 className="text-3xl font-bold mb-4">Payment Received</h1>
        <p>Booking confirmation is processing. Refresh shortly.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <h1 className="text-3xl font-bold mb-4">Processing</h1>
        <p>We are finalizing your booking. This usually takes a few seconds.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <h1 className="text-3xl font-bold mb-4">Payment Received</h1>
        <p>
          We received your payment but are still finalizing the booking.
          Please contact support with session ID: {sessionId}
        </p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <h1 className="text-3xl font-bold mb-4">Payment Received</h1>
        <p>
          We received your payment but are still finalizing the booking.
          Please contact support with session ID: {sessionId}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-20 text-center">
      <h1 className="text-3xl font-bold mb-4">Booking Confirmed</h1>
      <p>Your booking has been confirmed successfully.</p>
      <div className="mt-4 text-sm text-gray-500">
        {booking.date} {booking.start_time} - {booking.end_time}
      </div>
    </div>
  );
}
