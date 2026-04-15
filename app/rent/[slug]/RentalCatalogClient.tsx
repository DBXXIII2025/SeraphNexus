"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import MessageBusinessButton from "@/components/MessageBusinessButton";
import BusinessProfileShell from "@/components/BusinessProfileShell";
import type { BusinessPageImage, BusinessPageTheme } from "@/lib/businessPageCustomization";
import { translate, type LanguageCode } from "@/lib/i18n";

type PropertyItem = {
  id: string;
  name: string;
  description?: string | null;
  price?: number | null;
};

type RentalAvailabilityResponse = {
  available?: boolean;
  unavailableDates?: string[];
  reason?: string;
};

function getTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function RentalCatalogClient({
  business,
  properties,
  isOwner,
}: {
  business: {
    id: string;
    name: string;
    description: string;
    business_type: string;
    language: LanguageCode;
    logo_url: string | null;
    pageTheme: BusinessPageTheme;
    galleryImages: BusinessPageImage[];
  };
  properties: PropertyItem[];
  isOwner: boolean;
}) {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(
    properties[0]?.id || ""
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailableDates, setUnavailableDates] = useState<string[]>([]);

  const today = useMemo(() => getTodayDate(), []);
  const timeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  );
  const t = (key: Parameters<typeof translate>[1]) => translate(business.language, key);
  const selectedProperty = useMemo(
    () => properties.find((item) => item.id === selectedPropertyId) || null,
    [properties, selectedPropertyId]
  );

  const selectedRangeUnavailable = useMemo(() => {
    if (!startDate || !endDate || endDate <= startDate) {
      return false;
    }

    const cursor = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T00:00:00.000Z`);

    while (cursor < end) {
      const date = cursor.toISOString().slice(0, 10);
      if (unavailableDates.includes(date)) {
        return true;
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return false;
  }, [endDate, startDate, unavailableDates]);

  const refreshAvailability = useCallback(async (propertyId: string) => {
    if (!propertyId) {
      setUnavailableDates([]);
      return;
    }

    const res = await fetch(
      `/api/rent/availability?businessId=${business.id}&propertyId=${propertyId}&tz=${encodeURIComponent(
        timeZone
      )}`,
      { cache: "no-store" }
    );
    const data = (await res.json()) as RentalAvailabilityResponse;
    setUnavailableDates(data.unavailableDates || []);
  }, [business.id, timeZone]);

  useEffect(() => {
    if (selectedPropertyId) {
      void refreshAvailability(selectedPropertyId);
    }
  }, [refreshAvailability, selectedPropertyId]);

  async function handleCheckout() {
    setError(null);

    if (!selectedPropertyId || !selectedProperty) {
      setError("Select a rental or property listing first.");
      return;
    }

    if (!startDate || !endDate || endDate <= startDate) {
      setError("Choose a valid check-in and check-out range.");
      return;
    }

    if (startDate < today) {
      setError("Past dates are unavailable. Choose today or a future stay.");
      return;
    }

    if (selectedRangeUnavailable) {
      setError("Those dates overlap an unavailable stay. Choose another range.");
      return;
    }

    if (!customerName.trim() || !email.trim() || !phone.trim()) {
      setError("Enter your name, email, and phone to continue.");
      return;
    }

    setLoading(true);

    try {
      const availabilityRes = await fetch(
        `/api/rent/availability?businessId=${business.id}&propertyId=${selectedPropertyId}&startDate=${startDate}&endDate=${endDate}&tz=${encodeURIComponent(
          timeZone
        )}`,
        { cache: "no-store" }
      );
      const availabilityData =
        (await availabilityRes.json()) as RentalAvailabilityResponse;

      if (!availabilityRes.ok || availabilityData.available === false) {
        setError("Those dates are no longer available. Please choose another stay.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intentType: "booking",
          businessId: business.id,
          customer: {
            name: customerName,
            email,
            phone,
          },
          serviceMode: "onsite",
          propertyId: selectedPropertyId,
          slot: {
            date: startDate,
            endDate,
            startTime: "00:00",
            endTime: "23:59",
          },
          timezone: timeZone,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.url) {
        setError(data?.error || "Failed to start reservation checkout");
        setLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unexpected error while reserving");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-[var(--business-text,#111827)]">
      <div className="relative bg-[#f5f7fb] px-3 py-4 outline outline-2 outline-red-500 sm:py-5">
        <span className="pointer-events-none absolute left-2 top-2 z-30 rounded bg-red-700 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
          PUBLIC_PAGE_WRAPPER
        </span>
        <BusinessProfileShell
          businessName={business.name}
          businessDescription={business.description}
          businessType={business.business_type}
          logoUrl={business.logo_url}
          images={business.galleryImages}
          theme={business.pageTheme}
          action={
            <MessageBusinessButton
              businessId={business.id}
              className="inline-flex items-center rounded-lg bg-[var(--business-accent)] px-4 py-2 text-sm font-medium text-[var(--business-accent-text)]"
            />
          }
        />
      </div>
      <div className="circuit-shell bg-[var(--bg-main)] p-6 text-[var(--text-main)]">
        <div className="relative mx-auto max-w-6xl space-y-6">
        <p className="section-kicker">
          {business.business_type === "property"
            ? t("propertyStays")
            : t("rentalInventory")}
        </p>

        <div className="grid gap-6 lg:grid-cols-[1.4fr,0.9fr]">
          <div className="space-y-4">
            {!properties || properties.length === 0 ? (
              <div className="surface-card p-6 text-sm text-[var(--text-soft)]">
                No rental items have been added yet.
              </div>
            ) : (
              properties.map((property) => {
                const selected = property.id === selectedPropertyId;

                return (
                  <button
                    key={property.id}
                    type="button"
                    onClick={() => {
                      setSelectedPropertyId(property.id);
                      void refreshAvailability(property.id);
                    }}
                    className={`w-full rounded-2xl border p-5 text-left transition ${
                      selected
                        ? "border-[rgba(212,175,55,0.22)] bg-[rgba(36,29,29,0.96)] shadow-[0_0_18px_rgba(212,175,55,0.08)]"
                        : "border-[var(--border-soft)] bg-[var(--panel)] hover:border-[var(--accent-soft)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="font-semibold text-[var(--text-strong)]">
                          {property.name}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                          {property.description || "Private listing details available after booking."}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-[var(--accent-gold-soft)]">
                        ${Number(property.price || 0).toFixed(2)}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="surface-card p-6">
            <h2 className="text-xl font-semibold text-[var(--text-strong)]">
              {t("reserveDates")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
              Future dates remain bookable unless they are manually blocked or already reserved.
            </p>

            <div className="mt-5 space-y-3">
              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder={t("name")}
                className="input-field"
              />
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("emailAddress")}
                type="email"
                className="input-field"
              />
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder={t("phone")}
                className="input-field"
              />
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  type="date"
                  min={today}
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="input-field"
                />
                <input
                  type="date"
                  min={startDate || today}
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="input-field"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleCheckout}
              disabled={loading || !selectedProperty || selectedRangeUnavailable}
              className="btn-primary mt-5 w-full px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Checking availability..." : "Continue to secure checkout"}
            </button>

            {error ? (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}
            {selectedRangeUnavailable ? (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                Your selected range includes blocked or booked dates.
              </div>
            ) : null}

            <div className="mt-6 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-4">
              <h3 className="text-sm font-semibold text-[var(--text-strong)]">
                Unavailable dates
              </h3>
              {selectedProperty && unavailableDates.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--text-soft)]">
                  No blocked or booked dates currently published for this listing.
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {unavailableDates.slice(0, 20).map((date) => (
                    <span
                      key={date}
                      className="rounded-full border border-[var(--border-soft)] bg-[var(--panel)] px-3 py-1 text-xs text-[var(--text-soft)]"
                    >
                      {date}
                    </span>
                  ))}
                </div>
              )}
              {isOwner ? (
                <p className="mt-3 text-xs text-[var(--text-soft)]">
                  Owner tip: manage listing blocks from your admin rental calendar.
                </p>
              ) : null}
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
