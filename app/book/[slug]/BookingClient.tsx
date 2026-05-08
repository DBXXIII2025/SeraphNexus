"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import MessageBusinessButton from "@/components/MessageBusinessButton";
import BusinessProfileShell from "@/components/BusinessProfileShell";
import type { ServiceImageRecord } from "@/lib/serviceImages";
import type { BusinessPageImage, BusinessPageTheme } from "@/lib/businessPageCustomization";
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
  description?: string | null;
  price: number | null;
  duration: number | null;
  images: ServiceImageRecord[];
};

type BookingBusiness = {
  id: string;
  name: string | null;
  description?: string | null;
  business_type?: string | null;
  service_category?: string | null;
  service_category_label?: string | null;
  logo_url?: string | null;
  language?: "en" | "es" | null;
  onsite_enabled?: boolean | null;
  remote_enabled?: boolean | null;
  pageTheme: BusinessPageTheme;
  galleryImages: BusinessPageImage[];
  platformBrand?: {
    siteName: string;
    logoUrl?: string | null;
  };
  profileContact?: {
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    address?: string | null;
    serviceArea?: string | null;
    facebook?: string | null;
    instagram?: string | null;
    twitter?: string | null;
  };
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
          type: "service",
          business_id: business.id,
          item_id: selectedServiceIds[0],
          price: selectedServices.reduce((sum, service) => sum + Number(service.price || 0), 0),
          metadata: {
            service_ids: selectedServiceIds,
            customer: {
              name: customerName,
              email,
              phone,
            },
            service_mode: serviceMode,
            address: {
              line1: addressLine1,
              line2: addressLine2,
              city: addressCity,
              state: addressState,
              postalCode: addressPostal,
            },
            date: selectedDate,
            start_time: selectedSlot.start,
            end_time: selectedSlot.end,
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
    if (selectedServices.length === 0) {
      return;
    }

    console.info("[book/client] selected service payload", {
      businessId: business.id,
      selectedCount: selectedServices.length,
      serviceIds: selectedServices.map((service) => service.id),
      descriptionsPresent: selectedServices.map((service) => ({
        id: service.id,
        hasDescription: Boolean(service.description?.trim()),
      })),
      availabilityAnchorServiceId: selectedServices[0]?.id || null,
    });
  }, [business.id, selectedServices]);

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
    <div className="min-h-screen bg-[var(--page-bg)] text-[var(--text-main)]">
      <div className="px-3 py-5 sm:py-6">
        <BusinessProfileShell
          businessName={business.name || "Business"}
          businessDescription={business.description || ""}
          businessType={business.business_type || "Service"}
          businessCategory={business.service_category_label || null}
          logoUrl={business.logo_url}
          images={business.galleryImages}
          theme={business.pageTheme}
          platformBrand={business.platformBrand}
          contact={business.profileContact}
          action={
            <MessageBusinessButton
              businessId={business.id}
              className="btn-primary inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium"
            />
          }
        />
      </div>
      <div className="bg-[var(--page-bg)]">
      <div className="mx-auto max-w-6xl p-6 text-[var(--text-main)]">
      <p className="mb-4 text-sm text-[var(--text-soft)]">Your timezone: {timezone}</p>

      {selectedService ? (
        <div className="mb-6 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] shadow-inner">
              {selectedServiceImage?.image_url ? (
                <img
                  src={selectedServiceImage.image_url}
                  alt={selectedServiceImage.alt_text || `${selectedService.name || "Service"} cover`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center px-2 text-center text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--text-soft)]">
                  No image
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Selected service</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--text-main)]">{selectedService.name || "Service"}</h2>
              {selectedService.description ? (
                <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                  {selectedService.description}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-[var(--border-soft)] bg-[var(--accent-muted)] px-2.5 py-1 text-[var(--text-main)]">
                  ${Number(selectedService.price || 0).toFixed(2)}
                </span>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-200">
                  {selectedService.images.length > 0
                    ? `${selectedService.images.length} visual${selectedService.images.length === 1 ? "" : "s"}`
                    : "No service image"}
                </span>
              </div>
            </div>
            {selectedGallery.length > 0 ? (
              <div className="flex gap-2 sm:self-start">
                {selectedGallery.map((image) => (
                  <div
                    key={image.id}
                    className="h-12 w-12 overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--surface-raised)]"
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
        <label className="mb-2 block text-sm text-[var(--text-soft)]">{t("services")}</label>
        {services.length === 0 ? (
          <div className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3 text-sm text-[var(--text-soft)]">
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
                      ? "border-[var(--accent)] bg-[var(--accent-muted)] shadow-[var(--shadow-soft)]"
                      : "border-[var(--border-soft)] bg-[var(--surface)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--surface-raised)]">
                      {primaryImage?.image_url ? (
                        <img
                          src={primaryImage.image_url}
                          alt={primaryImage.alt_text || `${service.name || "Service"} cover`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center px-1 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-[var(--text-main)]">
                        {service.name || "Service"}
                      </div>
                      {service.description ? (
                        <p className="mt-1 text-sm leading-5 text-[var(--text-soft)]">
                          {service.description}
                        </p>
                      ) : null}
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-[var(--text-soft)]">
                        <span>${Number(service.price || 0).toFixed(2)}</span>
                      </div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                        {service.images.length > 0
                          ? `${service.images.length} image${service.images.length === 1 ? "" : "s"}`
                          : "No service image"}
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
        <label className="mb-1 block text-sm text-[var(--text-soft)]">{t("name")}</label>
        <input
          type="text"
          className="w-full rounded border border-[var(--border-soft)] bg-[var(--surface)] p-2 text-[var(--text-main)]"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Your full name"
          required
        />
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-sm text-[var(--text-soft)]">{t("phone")}</label>
        <input
          type="tel"
          className="w-full rounded border border-[var(--border-soft)] bg-[var(--surface)] p-2 text-[var(--text-main)]"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(555) 123-4567"
          required
        />
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-sm text-[var(--text-soft)]">{t("emailAddress")}</label>
        <input
          type="email"
          className="w-full rounded border border-[var(--border-soft)] bg-[var(--surface)] p-2 text-[var(--text-main)]"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-sm text-[var(--text-soft)]">{t("serviceMode")}</label>
        <div className="flex gap-3">
          {serviceModes.remote ? (
            <button
              type="button"
              onClick={() => setServiceMode("remote")}
              className={`flex-1 rounded border py-2 ${
                serviceMode === "remote"
                  ? "border-[var(--accent)] bg-[var(--accent-muted)]"
                  : "border-[var(--border-strong)] bg-[var(--surface-muted)]"
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
                  ? "border-[var(--accent)] bg-[var(--accent-muted)]"
                  : "border-[var(--border-strong)] bg-[var(--surface-muted)]"
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
            className="w-full rounded border border-[var(--border-soft)] bg-[var(--surface)] p-2 text-[var(--text-main)]"
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            placeholder={t("streetAddress")}
            required
          />
          <input
            type="text"
            className="w-full rounded border border-[var(--border-soft)] bg-[var(--surface)] p-2 text-[var(--text-main)]"
            value={addressLine2}
            onChange={(e) => setAddressLine2(e.target.value)}
            placeholder={t("aptSuiteOptional")}
          />
          <input
            type="text"
            className="w-full rounded border border-[var(--border-soft)] bg-[var(--surface)] p-2 text-[var(--text-main)]"
            value={addressCity}
            onChange={(e) => setAddressCity(e.target.value)}
            placeholder={t("city")}
            required
          />
          <div className="flex gap-3">
            <input
              type="text"
              className="w-full rounded border border-[var(--border-soft)] bg-[var(--surface)] p-2 text-[var(--text-main)]"
              value={addressState}
              onChange={(e) => setAddressState(e.target.value)}
              placeholder={t("state")}
              required
            />
            <input
              type="text"
              className="w-full rounded border border-[var(--border-soft)] bg-[var(--surface)] p-2 text-[var(--text-main)]"
              value={addressPostal}
              onChange={(e) => setAddressPostal(e.target.value)}
              placeholder={t("zip")}
              required
            />
          </div>
        </div>
      )}

      <div className="mb-4">
        <label className="mb-1 block text-sm text-[var(--text-soft)]">{t("date")}</label>
        <input
          type="date"
          className="rounded border border-[var(--border-soft)] bg-[var(--surface)] p-2 text-[var(--text-main)]"
          value={selectedDate}
          min={todayDate}
          onChange={(e) => {
            setSelectedDate(e.target.value);
            setSelectedSlotKey("");
          }}
          disabled={services.length === 0}
        />
        {showEmptyState && (
          <div className="mt-3 rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3 text-sm text-[var(--text-soft)]">
            <p>{availabilityMessage}</p>
            {availabilityConfigured === false && isOwner && (
              <a href="/admin/calendar" className="text-[#D1D5DB] underline">
                Set availability in your admin calendar
              </a>
            )}
          </div>
        )}
      </div>

      {schedulingModel === "flexible_date" && selectedDate && slots.length > 0 ? (
        <div className="mb-4 rounded-md border border-[var(--accent-border)] bg-[var(--accent-muted)] p-3 text-sm text-[var(--text-main)]">
          This business accepts date-based bookings. Choose your service date and complete checkout.
          The business can confirm the exact time afterward.
        </div>
      ) : null}

      {error && <p className="mb-4 text-red-400">{error}</p>}

      {isLoading && <p>{t("loadingAvailability")}</p>}

      <div className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-sm text-[var(--text-soft)]">{t("time")}</label>
          <select
            value={selectedSlotKey}
            onChange={(event) => setSelectedSlotKey(event.target.value)}
            disabled={!selectedDate || isLoading || slots.length === 0}
            className="w-full rounded border border-[var(--border-strong)] bg-[var(--surface-muted)] p-3 text-[var(--text-main)] disabled:cursor-not-allowed disabled:opacity-60"
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
          <p className="mt-2 text-xs text-[var(--text-soft)]">
            Select a date and time, review your booking, then use Pay to continue to secure checkout.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">{t("review")}</p>
          <div className="mt-3 space-y-2 text-sm text-[var(--text-main)]">
            <div>
              {t("services")}:{" "}
              {selectedServices.length > 0
                ? selectedServices.map((service) => service.name || "Service").join(", ")
                : t("selectService")}
            </div>
            {selectedServices.length > 0 ? (
              <div className="space-y-2">
                {selectedServices.map((service) =>
                  service.description ? (
                    <div
                      key={`review-description-${service.id}`}
                      className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-3"
                    >
                      <p className="font-medium">{service.name || "Service"}</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--text-soft)]">
                        {service.description}
                      </p>
                    </div>
                  ) : null
                )}
              </div>
            ) : null}
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
              <div className="text-xs text-[var(--text-main)]">
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
            className="mt-4 inline-flex rounded bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-soft)] active:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Starting secure checkout..." : t("pay")}
          </button>
        </div>
      </div>
      </div>
      </div>
    </div>
  );
}
