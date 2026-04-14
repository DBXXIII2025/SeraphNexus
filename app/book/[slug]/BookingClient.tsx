"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import MessageBusinessButton from "@/components/MessageBusinessButton";
import PublicBusinessPolicies from "@/components/PublicBusinessPolicies";
import type { ServiceImageRecord } from "@/lib/serviceImages";
import { translate } from "@/lib/i18n";

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
  language?: "en" | "es" | null;
  onsite_enabled?: boolean | null;
  remote_enabled?: boolean | null;
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
    return `${formatCustomerTime(slot.start)} - ${formatCustomerTime(slot.end)}`;
  }

  return "Flexible scheduling";
}

function formatCustomerTime(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const [hoursText, minutesText] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText || "0");

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return value;
  }

  const parsed = new Date();
  parsed.setHours(hours, minutes, 0, 0);

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
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
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlotKey, setSelectedSlotKey] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [serviceMode, setServiceMode] = useState<"onsite" | "remote">(
    business.remote_enabled !== false ? "remote" : "onsite"
  );
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const t = (key: Parameters<typeof translate>[1]) => translate(business.language, key);
  const todayDate = useMemo(() => getTodayLocalDate(), []);
  const selectedServices = useMemo(
    () => services.filter((service) => selectedServiceIds.includes(service.id)),
    [selectedServiceIds, services]
  );
  const selectedService = selectedServices[0] || null;
  const selectedServiceImage = selectedService ? getPrimaryImage(selectedService) : null;
  const selectedGallery = selectedService
    ? selectedService.images.filter((image) => image.id !== selectedServiceImage?.id).slice(0, 3)
    : [];
  const businessInitials = getInitials(business.name);
  const selectedSlot = useMemo(() => {
    return (
      slots.find(
        (slot) => `${slot.start || "flex"}__${slot.end || "date"}` === selectedSlotKey
      ) || null
    );
  }, [selectedSlotKey, slots]);
  const selectedServicesTotal = selectedServices.reduce(
    (sum, service) => sum + Number(service.price || 0),
    0
  );
  const selectedSlotPrice = selectedServicesTotal;
  const serviceModes = {
    onsite: business.onsite_enabled !== false,
    remote: business.remote_enabled !== false,
  };
  const hasEnabledServiceMode = serviceModes.onsite || serviceModes.remote;

  const fetchSlots = useCallback(
    async (date: string) => {
      const primaryServiceId = selectedServiceIds[0];
      if (!primaryServiceId) {
        setSlots([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/availability?businessId=${business.id}&serviceId=${encodeURIComponent(
            primaryServiceId
          )}&date=${date}&tz=${encodeURIComponent(timezone)}`,
          { cache: "no-store" }
        );
        const data = await res.json();

        if (!res.ok) {
          console.log("[book/client] availability rejected", {
            businessId: business.id,
            serviceId: primaryServiceId,
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
          serviceId: primaryServiceId,
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
        setSelectedSlotKey("");
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
    [business.id, selectedServiceIds, services.length, timezone]
  );

  const handleBooking = async () => {
    setError(null);

    if (isSubmitting) {
      return;
    }

    if (selectedServiceIds.length === 0) {
      setError("Please select at least one service before booking.");
      return;
    }

    if (!selectedDate) {
      setError("Please choose a date before continuing.");
      return;
    }

    if (!selectedSlot) {
      setError("Please choose a time before continuing.");
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

    if (serviceMode === "onsite" && !serviceModes.onsite) {
      setError("On-site service is not available for this business.");
      return;
    }

    if (serviceMode === "remote" && !serviceModes.remote) {
      setError("Remote service is not available for this business.");
      return;
    }
    if (!hasEnabledServiceMode) {
      setError("Booking is not available for this business right now.");
      return;
    }

    setIsSubmitting(true);

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
          serviceId: selectedServiceIds[0],
          serviceIds: selectedServiceIds,
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
            startTime: selectedSlot.start,
            endTime: selectedSlot.end,
            schedulingModel: selectedSlot.scheduling_model || schedulingModel,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.log("[book/client] checkout rejected", {
          businessId: business.id,
          serviceIds: selectedServiceIds,
          slotStart: selectedSlot.start,
          slotEnd: selectedSlot.end,
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
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (selectedServiceIds.length === 0 && services.length > 0) {
      setSelectedServiceIds([String(services[0].id)]);
    }
  }, [selectedServiceIds.length, services]);

  useEffect(() => {
    if (!selectedDate || selectedServiceIds.length === 0) return;
    void fetchSlots(selectedDate);
  }, [fetchSlots, selectedDate, selectedServiceIds.length]);

  useEffect(() => {
    if (serviceMode === "remote" && !serviceModes.remote && serviceModes.onsite) {
      setServiceMode("onsite");
    }
    if (serviceMode === "onsite" && !serviceModes.onsite && serviceModes.remote) {
      setServiceMode("remote");
    }
  }, [serviceMode, serviceModes.onsite, serviceModes.remote]);

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
        <label className="mb-2 block text-sm text-gray-300">{t("services")}</label>
        {services.length === 0 ? (
          <div className="rounded-md border border-white/10 bg-black/30 p-3 text-sm text-gray-300">
            No services are published for this business yet.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {services.map((service) => {
              const isSelected = selectedServiceIds.includes(service.id);
              const primaryImage = getPrimaryImage(service);

              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => {
                    setSelectedServiceIds((current) =>
                      current.includes(service.id)
                        ? current.filter((id) => id !== service.id)
                        : [...current, service.id]
                    );
                    setSelectedSlotKey("");
                  }}
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
        <label className="mb-1 block text-sm text-gray-300">{t("name")}</label>
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
        <label className="mb-1 block text-sm text-gray-300">{t("phone")}</label>
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
        <label className="mb-1 block text-sm text-gray-300">{t("emailAddress")}</label>
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
        <label className="mb-1 block text-sm text-gray-300">{t("serviceMode")}</label>
        <div className="flex gap-3">
          {serviceModes.remote ? (
            <button
              type="button"
              onClick={() => setServiceMode("remote")}
              className={`flex-1 rounded border py-2 ${
                serviceMode === "remote"
                  ? "border-blue-400 bg-blue-600/20"
                  : "border-white/20 bg-black/20"
              }`}
            >
              {t("remote")}
            </button>
          ) : null}
          {serviceModes.onsite ? (
            <button
              type="button"
              onClick={() => setServiceMode("onsite")}
              className={`flex-1 rounded border py-2 ${
                serviceMode === "onsite"
                  ? "border-blue-400 bg-blue-600/20"
                  : "border-white/20 bg-black/20"
              }`}
            >
              {t("onsite")}
            </button>
          ) : null}
        </div>
        {!hasEnabledServiceMode ? (
          <p className="mt-2 text-xs text-red-300">
            Booking is not available for this business right now.
          </p>
        ) : null}
      </div>

      {serviceMode === "onsite" && serviceModes.onsite && (
        <div className="mb-4 space-y-2">
          <input
            type="text"
            className="w-full p-2 text-black"
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            placeholder={t("streetAddress")}
            required
          />
          <input
            type="text"
            className="w-full p-2 text-black"
            value={addressLine2}
            onChange={(e) => setAddressLine2(e.target.value)}
            placeholder={t("aptSuiteOptional")}
          />
          <input
            type="text"
            className="w-full p-2 text-black"
            value={addressCity}
            onChange={(e) => setAddressCity(e.target.value)}
            placeholder={t("city")}
            required
          />
          <div className="flex gap-3">
            <input
              type="text"
              className="w-full p-2 text-black"
              value={addressState}
              onChange={(e) => setAddressState(e.target.value)}
              placeholder={t("state")}
              required
            />
            <input
              type="text"
              className="w-full p-2 text-black"
              value={addressPostal}
              onChange={(e) => setAddressPostal(e.target.value)}
              placeholder={t("zip")}
              required
            />
          </div>
        </div>
      )}

      <div className="mb-4">
        <label className="mb-1 block text-sm text-gray-300">{t("date")}</label>
        <input
          type="date"
          className="p-2 text-black"
          value={selectedDate}
          min={todayDate}
          onChange={(e) => {
            setSelectedDate(e.target.value);
            setSelectedSlotKey("");
          }}
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

      {isLoading && <p>{t("loadingAvailability")}</p>}

      <div className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-sm text-gray-300">{t("time")}</label>
          <select
            value={selectedSlotKey}
            onChange={(event) => setSelectedSlotKey(event.target.value)}
            disabled={!selectedDate || isLoading || slots.length === 0}
            className="w-full rounded border border-white/20 bg-black/30 p-3 text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">
              {isLoading
                ? t("loadingTimes")
                : selectedDate
                  ? t("selectTime")
                  : t("chooseDateFirst")}
            </option>
            {slots.map((slot, index) => {
              const slotKey = `${slot.start || "flex"}__${slot.end || "date"}`;
              return (
                <option
                  key={`${slotKey}-${index}`}
                  value={slotKey}
                >
                  {formatSlotLabel(slot)}
                </option>
              );
            })}
          </select>
          <p className="mt-2 text-xs text-gray-400">
            Select a date and time, review your booking, then use Pay to continue to secure checkout.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-gray-500">{t("review")}</p>
          <div className="mt-3 space-y-2 text-sm text-gray-200">
            <div>
              {t("services")}:{" "}
              {selectedServices.length > 0
                ? selectedServices.map((service) => service.name || "Service").join(", ")
                : t("selectService")}
            </div>
            <div>{t("date")}: {selectedDate || t("selectDate")}</div>
            <div>{t("time")}: {selectedSlot ? formatSlotLabel(selectedSlot) : t("selectTime")}</div>
            <div>
              {t("serviceMode")}:{" "}
              {hasEnabledServiceMode
                ? serviceMode === "remote"
                  ? t("remote")
                  : t("onsite")
                : "Unavailable"}
            </div>
            <div>{t("total")}: ${selectedSlotPrice.toFixed(2)}</div>
            {selectedSlot?.is_flexible ? (
              <div className="text-xs text-blue-100">
                Exact scheduling can be confirmed after booking.
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => void handleBooking()}
            disabled={
              isSubmitting ||
              isLoading ||
              !selectedDate ||
              !selectedSlot ||
              selectedServiceIds.length === 0 ||
              !hasEnabledServiceMode
            }
            className="mt-4 w-full rounded bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Starting secure checkout..." : t("pay")}
          </button>
        </div>
      </div>
    </div>
  );
}
