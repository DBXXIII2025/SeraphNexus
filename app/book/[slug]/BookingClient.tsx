"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import MessageBusinessButton from "@/components/MessageBusinessButton";
import PublicBusinessPolicies from "@/components/PublicBusinessPolicies";
import type { ServiceImageRecord } from "@/lib/serviceImages";

type Slot = {
  start: string | null;
  end: string | null;
  price: number;
  base_price: number;
  price_adjustment: number;
  pricing_adjustment_applied: boolean;
  demand_score: number;
  scheduling_model?: "strict_slot" | "flexible_date";
  is_flexible?: boolean;
};

type Service = {
  id: string;
  name: string | null;
  price: number | null;
  duration: number | null;
  images: ServiceImageRecord[];
};

type BookingBusiness = {
  id: string;
  name: string | null;
  description?: string | null;
  business_type?: string | null;
  logo_url?: string | null;
};

function getTodayLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatSlotLabel(slot: Slot) {
  if (slot.start && slot.end) {
    return `${slot.start} - ${slot.end}`;
  }

  return "Flexible scheduling";
}

function getAvailabilityMessage(reason: string | null, availabilityConfigured: boolean) {
  if (reason === "past_date") {
    return "Please choose a future date.";
  }

  if (availabilityConfigured === false) {
    return "Flexible date booking is available for this business.";
  }

  if (reason === "all_slots_blocked") {
    return "All time slots are booked for this date.";
  }

  return "No available slots for this date.";
}

function getPrimaryImage(service: Service) {
  return service.images.find((image) => image.is_primary) || service.images[0] || null;
}

function getInitials(name: string | null | undefined) {
  const parts = String(name || "Business")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "BN";
}

export default function BookingClient({
  business,
  services,
  isOwner,
}: {
  business: BookingBusiness;
  services: Service[];
  isOwner: boolean;
}) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [serviceMode, setServiceMode] = useState<"onsite" | "remote">("remote");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [addressPostal, setAddressPostal] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availabilityConfigured, setAvailabilityConfigured] = useState(true);
  const [schedulingModel, setSchedulingModel] = useState<
    "strict_slot" | "flexible_date"
  >("strict_slot");
  const [availabilityReason, setAvailabilityReason] = useState<string | null>(null);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const todayDate = useMemo(() => getTodayLocalDate(), []);
  const selectedService =
    services.find((service) => service.id === selectedServiceId) || null;
  const selectedServiceImage = selectedService ? getPrimaryImage(selectedService) : null;
  const selectedGallery = selectedService
    ? selectedService.images.filter((image) => image.id !== selectedServiceImage?.id).slice(0, 3)
    : [];
  const businessInitials = getInitials(business.name);

  const fetchSlots = useCallback(
    async (date: string) => {
      if (!selectedServiceId) {
        setSlots([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/availability?businessId=${business.id}&serviceId=${encodeURIComponent(
            selectedServiceId
          )}&date=${date}&tz=${encodeURIComponent(timezone)}`,
          { cache: "no-store" }
        );
        const data = await res.json();

        if (!res.ok) {
          console.log("[book/client] availability rejected", {
            businessId: business.id,
            serviceId: selectedServiceId,
            date,
            errorCode: data?.code || null,
            errorStep: data?.step || null,
          });
          setError(data?.error || "Failed to load availability");
          setSlots([]);
          return;
        }

        console.log("[book/client] availability loaded", {
          businessId: business.id,
          serviceId: selectedServiceId,
          date,
          slotCount: Array.isArray(data.slots) ? data.slots.length : 0,
          sourceRecordType: "services",
          sourceRecordCount: services.length,
          pricingAdjustmentsApplied: Array.isArray(data.slots)
            ? data.slots.some(
                (slot: Slot) => Number(slot.price_adjustment || 0) !== 0
              )
            : false,
        });
        setSlots(data.slots || []);
        setAvailabilityConfigured(data.availabilityConfigured !== false);
        setSchedulingModel(data.schedulingModel || "strict_slot");
        setAvailabilityReason(data.reason || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load availability");
        setSlots([]);
      } finally {
        setIsLoading(false);
      }
    },
    [business.id, selectedServiceId, services.length, timezone]
  );

  const handleBooking = async (slot: Slot) => {
    setError(null);

    if (!selectedServiceId) {
      setError("Please select a service before booking.");
      return;
    }

    if (!selectedDate) {
      setError("Please choose a date before continuing.");
      return;
    }

    if (!customerName.trim()) {
      setError("Please enter your name to continue.");
      return;
    }

    if (!phone.trim()) {
      setError("Please enter your phone number to continue.");
      return;
    }

    if (!email.trim()) {
      setError("Please enter your email to continue.");
      return;
    }

    if (serviceMode === "onsite") {
      if (
        !addressLine1.trim() ||
        !addressCity.trim() ||
        !addressState.trim() ||
        !addressPostal.trim()
      ) {
        setError("Please enter your address for onsite service.");
        return;
      }
    }

    try {
      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intentType: "booking",
          businessId: business.id,
          businessType: business.business_type || "service",
          serviceId: selectedServiceId,
          customer: {
            name: customerName,
            email,
            phone,
          },
          serviceMode,
          address: {
            line1: addressLine1,
            line2: addressLine2,
            city: addressCity,
            state: addressState,
            postalCode: addressPostal,
          },
          slot: {
            date: selectedDate,
            startTime: slot.start,
            endTime: slot.end,
            schedulingModel: slot.scheduling_model || schedulingModel,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.log("[book/client] checkout rejected", {
          businessId: business.id,
          serviceId: selectedServiceId,
          slotStart: slot.start,
          slotEnd: slot.end,
          errorCode: data?.code || null,
          errorStep: data?.step || null,
        });
        setError(data?.error || "Failed to start checkout");
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        setError("Stripe checkout URL was not returned.");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unexpected error while starting checkout."
      );
    }
  };

  useEffect(() => {
    if (!selectedServiceId && services.length > 0) {
      setSelectedServiceId(String(services[0].id));
    }
  }, [selectedServiceId, services]);

  useEffect(() => {
    if (!selectedDate || !selectedServiceId) return;
    void fetchSlots(selectedDate);
  }, [fetchSlots, selectedDate, selectedServiceId]);

  const showEmptyState = selectedDate && !isLoading && slots.length === 0;
  const availabilityMessage = getAvailabilityMessage(
    availabilityReason,
    availabilityConfigured
  );

  return (
    <div className="p-6 text-white">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),rgba(24,24,27,0.92))] shadow-inner">
            {business.logo_url ? (
              <img
                src={business.logo_url}
                alt={`${business.name || "Business"} logo`}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-sm font-semibold tracking-[0.16em] text-gray-200">
                {businessInitials}
              </span>
            )}
          </div>
          <div>
            <h1 className="mb-2 text-2xl">{business.name}</h1>
            <p className="text-sm text-gray-400">Your timezone: {timezone}</p>
          </div>
        </div>
        <MessageBusinessButton
          businessId={business.id}
          className="inline-flex items-center rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-black/30"
        />
      </div>

      <div className="mb-6">
        <PublicBusinessPolicies description={business.description || ""} />
      </div>

      {selectedService ? (
        <div className="mb-6 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(39,39,42,0.5),rgba(9,9,11,0.85))] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),rgba(24,24,27,0.92))] shadow-inner">
              {selectedServiceImage?.image_url ? (
                <img
                  src={selectedServiceImage.image_url}
                  alt={selectedServiceImage.alt_text || `${selectedService.name || "Service"} cover`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center px-2 text-center text-[10px] font-medium uppercase tracking-[0.22em] text-gray-400">
                  Signature
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500">Selected service</p>
              <h2 className="mt-1 text-lg font-semibold text-white">{selectedService.name || "Service"}</h2>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-gray-200">
                  ${Number(selectedService.price || 0).toFixed(2)}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-gray-200">
                  {selectedService.duration || 60} min
                </span>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-200">
                  {selectedService.images.length > 0
                    ? `${selectedService.images.length} visual${selectedService.images.length === 1 ? "" : "s"}`
                    : "Premium fallback"}
                </span>
              </div>
            </div>
            {selectedGallery.length > 0 ? (
              <div className="flex gap-2 sm:self-start">
                {selectedGallery.map((image) => (
                  <div
                    key={image.id}
                    className="h-12 w-12 overflow-hidden rounded-xl border border-white/10 bg-zinc-950"
                  >
                    {image.image_url ? (
                      <img
                        src={image.image_url}
                        alt={image.alt_text || `${selectedService.name || "Service"} gallery image`}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mb-6">
        <label className="mb-2 block text-sm text-gray-300">Service</label>
        {services.length === 0 ? (
          <div className="rounded-md border border-white/10 bg-black/30 p-3 text-sm text-gray-300">
            No services are published for this business yet.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {services.map((service) => {
              const isSelected = selectedServiceId === service.id;
              const primaryImage = getPrimaryImage(service);

              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => setSelectedServiceId(service.id)}
                  className={`rounded-2xl border p-3 text-left transition ${
                    isSelected
                      ? "border-blue-400 bg-blue-600/20 shadow-[0_10px_30px_rgba(59,130,246,0.14)]"
                      : "border-white/10 bg-[linear-gradient(180deg,rgba(24,24,27,0.9),rgba(9,9,11,0.96))] hover:border-white/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),rgba(24,24,27,0.92))]">
                      {primaryImage?.image_url ? (
                        <img
                          src={primaryImage.image_url}
                          alt={primaryImage.alt_text || `${service.name || "Service"} cover`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center px-1 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-gray-500">
                          Icon
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-white">
                        {service.name || "Service"}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-300">
                        <span>${Number(service.price || 0).toFixed(2)}</span>
                        <span className="text-gray-500">•</span>
                        <span>{service.duration || 60} min</span>
                      </div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-gray-500">
                        {service.images.length > 0
                          ? `${service.images.length} image${service.images.length === 1 ? "" : "s"}`
                          : "Curated visual coming soon"}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-sm text-gray-300">Name</label>
        <input
          type="text"
          className="w-full p-2 text-black"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Your full name"
          required
        />
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-sm text-gray-300">Phone</label>
        <input
          type="tel"
          className="w-full p-2 text-black"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(555) 123-4567"
          required
        />
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-sm text-gray-300">Email</label>
        <input
          type="email"
          className="w-full p-2 text-black"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-sm text-gray-300">Service Mode</label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setServiceMode("remote")}
            className={`flex-1 rounded border py-2 ${
              serviceMode === "remote"
                ? "border-blue-400 bg-blue-600/20"
                : "border-white/20 bg-black/20"
            }`}
          >
            Remote
          </button>
          <button
            type="button"
            onClick={() => setServiceMode("onsite")}
            className={`flex-1 rounded border py-2 ${
              serviceMode === "onsite"
                ? "border-blue-400 bg-blue-600/20"
                : "border-white/20 bg-black/20"
            }`}
          >
            Onsite
          </button>
        </div>
      </div>

      {serviceMode === "onsite" && (
        <div className="mb-4 space-y-2">
          <input
            type="text"
            className="w-full p-2 text-black"
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            placeholder="Street address"
            required
          />
          <input
            type="text"
            className="w-full p-2 text-black"
            value={addressLine2}
            onChange={(e) => setAddressLine2(e.target.value)}
            placeholder="Apt / Suite (optional)"
          />
          <input
            type="text"
            className="w-full p-2 text-black"
            value={addressCity}
            onChange={(e) => setAddressCity(e.target.value)}
            placeholder="City"
            required
          />
          <div className="flex gap-3">
            <input
              type="text"
              className="w-full p-2 text-black"
              value={addressState}
              onChange={(e) => setAddressState(e.target.value)}
              placeholder="State"
              required
            />
            <input
              type="text"
              className="w-full p-2 text-black"
              value={addressPostal}
              onChange={(e) => setAddressPostal(e.target.value)}
              placeholder="ZIP"
              required
            />
          </div>
        </div>
      )}

      <div className="mb-4">
        <label className="mb-1 block text-sm text-gray-300">Date</label>
        <input
          type="date"
          className="p-2 text-black"
          value={selectedDate}
          min={todayDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          disabled={services.length === 0}
        />
        {showEmptyState && (
          <div className="mt-3 rounded-md border border-white/10 bg-black/30 p-3 text-sm text-gray-300">
            <p>{availabilityMessage}</p>
            {availabilityConfigured === false && isOwner && (
              <a href="/admin/calendar" className="text-purple-300 underline">
                Set availability in your admin calendar
              </a>
            )}
          </div>
        )}
      </div>

      {schedulingModel === "flexible_date" && selectedDate && slots.length > 0 ? (
        <div className="mb-4 rounded-md border border-blue-400/30 bg-blue-600/10 p-3 text-sm text-blue-100">
          This business accepts date-based bookings. Choose your service date and complete checkout.
          The business can confirm the exact time afterward.
        </div>
      ) : null}

      {error && <p className="mb-4 text-red-400">{error}</p>}

      {isLoading && <p>Loading availability...</p>}

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        {slots.map((slot, index) => {
          const basePrice = Number(
            selectedService?.price ?? slot.base_price ?? slot.price
          );
          const finalPrice = Number(slot.price || 0);
          const priceAdjustment = Number(slot.price_adjustment || 0);
          const hasAdjustment =
            slot.pricing_adjustment_applied || Math.abs(priceAdjustment) > 0.009;

          return (
            <button
              key={`${slot.start || "flex"}-${slot.end || "date"}-${index}`}
              onClick={() => handleBooking(slot)}
              className="rounded bg-blue-600 p-3 text-left hover:bg-blue-700"
            >
              <div className="font-semibold">{formatSlotLabel(slot)}</div>
              {selectedService ? (
                <div className="text-sm text-gray-100">
                  {selectedService.name || "Selected service"}
                </div>
              ) : null}
              <div className="text-sm">
                Base service price: ${basePrice.toFixed(2)}
              </div>
              <div className="text-sm font-medium">
                Final total: ${finalPrice.toFixed(2)}
              </div>
              {slot.is_flexible ? (
                <div className="mt-1 text-xs text-blue-100">
                  Exact scheduling can be confirmed after booking.
                </div>
              ) : hasAdjustment ? (
                <div className="mt-1 text-xs text-gray-200">
                  Pricing adjustment: {priceAdjustment >= 0 ? "+" : "-"}$
                  {Math.abs(priceAdjustment).toFixed(2)}
                </div>
              ) : (
                <div className="mt-1 text-xs text-gray-200">
                  No pricing adjustment applied
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
