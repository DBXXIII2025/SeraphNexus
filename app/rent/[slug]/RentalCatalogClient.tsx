"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import MessageBusinessButton from "@/components/MessageBusinessButton";
import BusinessProfileShell from "@/components/BusinessProfileShell";
import StructuredIcon from "@/components/icons/StructuredIcon";
import type { BusinessPageImage, BusinessPageTheme } from "@/lib/businessPageCustomization";
import { translate, type LanguageCode } from "@/lib/i18n";
import {
  formatAmenityCount,
  getEnabledPropertyAmenities,
  normalizePropertyAmenityData,
} from "@/lib/propertyAmenities";

type PropertyItem = {
  id: string;
  name: string;
  description?: string | null;
  price?: number | null;
  amenity_data?: unknown;
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
    mapQuery?: string | null;
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
  const selectedAmenities = useMemo(
    () => normalizePropertyAmenityData(selectedProperty?.amenity_data),
    [selectedProperty]
  );
  const enabledAmenities = useMemo(
    () => getEnabledPropertyAmenities(selectedProperty?.amenity_data),
    [selectedProperty]
  );
  const countHighlights = useMemo(
    () =>
      [
        { label: formatAmenityCount(selectedAmenities.bedrooms, "bedroom"), icon: "bed" as const },
        {
          label: formatAmenityCount(selectedAmenities.bathrooms, "bathroom"),
          icon: "bath" as const,
        },
      ].filter((item) => Boolean(item.label)),
    [selectedAmenities.bathrooms, selectedAmenities.bedrooms]
  );
  const propertyFacts = useMemo(
    () =>
      [
        ...countHighlights,
        selectedAmenities.petsAllowed
          ? { label: "Pets allowed", icon: "pets" as const }
          : null,
        selectedAmenities.parking
          ? { label: "Parking", icon: "parking" as const }
          : null,
      ].filter((item): item is { label: string; icon: "bed" | "bath" | "pets" | "parking" } =>
        Boolean(item?.label)
      ),
    [countHighlights, selectedAmenities.parking, selectedAmenities.petsAllowed]
  );
  const secondaryAmenities = useMemo(
    () =>
      enabledAmenities.filter(
        (amenity) => amenity.key !== "petsAllowed" && amenity.key !== "parking"
      ),
    [enabledAmenities]
  );
  const mapEmbedUrl = useMemo(() => {
    const query = business.mapQuery?.trim();
    return query ? `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed` : null;
  }, [business.mapQuery]);
  const mapExternalUrl = useMemo(() => {
    const query = business.mapQuery?.trim();
    return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
  }, [business.mapQuery]);

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
    <div className="min-h-screen bg-[var(--page-bg)] text-[var(--text-main)]">
      <div className="px-3 py-5 sm:py-6">
        <BusinessProfileShell
          businessName={business.name}
          businessDescription={business.description}
          businessType={business.business_type}
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
      <div className="bg-[var(--bg-main)] px-6 py-5 text-[var(--text-main)]">
        <div className="relative mx-auto max-w-6xl space-y-6">
        <p className="section-kicker">
          {business.business_type === "property"
            ? t("propertyStays")
            : t("rentalInventory")}
        </p>

        <div className="grid gap-6 lg:grid-cols-[1.4fr,0.9fr]">
          <div className="space-y-4">
            {!properties || properties.length === 0 ? (
              <div className="border-t border-[var(--border-soft)] pt-4 text-sm text-[var(--text-soft)]">
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
                    className={`w-full rounded-lg border px-4 py-4 text-left transition ${
                      selected
                        ? "border-[var(--accent)] bg-[var(--accent-muted)]"
                        : "border-[var(--border-soft)] hover:border-[var(--accent-soft)]"
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
                      <p className="text-sm font-semibold text-[var(--accent-soft)]">
                        ${Number(property.price || 0).toFixed(2)}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-[var(--border-soft)] pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <h2 className="text-xl font-semibold text-[var(--text-strong)]">
              {t("reserveDates")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
              Future dates remain bookable unless they are manually blocked or already reserved.
            </p>

            {selectedProperty ? (
                <div className="mt-5 space-y-3">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Selected listing
                </p>
                <h3 className="font-semibold text-[var(--text-strong)]">
                  {selectedProperty.name}
                </h3>
                {countHighlights.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {countHighlights.map((item) => (
                      <span
                        key={item.label}
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-border)] bg-[var(--accent-muted)] px-3 py-1 text-xs font-semibold text-[var(--accent-soft)]"
                      >
                        <StructuredIcon name={item.icon} className="h-4 w-4" />
                        {item.label}
                      </span>
                    ))}
                  </div>
                ) : null}
                {selectedProperty.description ? (
                  <p className="text-sm leading-6 text-[var(--text-soft)]">
                    {selectedProperty.description}
                  </p>
                ) : null}
                <p className="text-sm font-semibold text-[var(--text-main)]">
                  ${Number(selectedProperty.price || 0).toFixed(2)}
                </p>
              </div>
            ) : null}

            {selectedProperty && (propertyFacts.length > 0 || secondaryAmenities.length > 0) ? (
              <section className="mt-5 border-t border-[var(--border-soft)] pt-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-[var(--text-strong)]">Property facts</h3>
                  <span className="text-xs text-[var(--text-muted)]">
                    {enabledAmenities.length} amenities shown
                  </span>
                </div>

                {propertyFacts.length > 0 ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {propertyFacts.map((fact) => (
                      <div
                        key={fact.label}
                        className="flex items-center gap-2.5 border-b border-[var(--border-soft)] py-2 text-sm text-[var(--text-main)]"
                      >
                        <StructuredIcon
                          name={fact.icon}
                          className="h-3.5 w-3.5 shrink-0 text-[var(--accent-soft)]"
                        />
                        <span className="font-medium leading-5">{fact.label}</span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {secondaryAmenities.length > 0 ? (
                  <div className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                    {secondaryAmenities.map((amenity) => (
                      <div
                        key={amenity.key}
                        className="flex items-center gap-2.5 py-1 text-sm text-[var(--text-soft)]"
                      >
                        <StructuredIcon
                          name={amenity.icon}
                          className="h-3.5 w-3.5 shrink-0 text-[var(--accent-soft)]"
                        />
                        <span className="leading-5">{amenity.label}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

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

            <div className="mt-6 border-t border-[var(--border-soft)] pt-4">
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

        {mapEmbedUrl ? (
          <section className="border-t border-[var(--border-soft)] pt-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-[var(--text-strong)]">Location</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                  Explore the area around this {business.business_type === "property" ? "property" : "rental"}.
                </p>
              </div>
              {mapExternalUrl ? (
                <a
                  href={mapExternalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="public-action-secondary"
                >
                  Open map
                </a>
              ) : null}
            </div>
            <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border-soft)]">
              <iframe
                title={`${business.name} location map`}
                src={mapEmbedUrl}
                className="h-[320px] w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <p className="mt-3 flex items-center gap-2 text-sm text-[var(--text-soft)]">
              <StructuredIcon name="mapPin" className="h-4 w-4 text-[var(--accent-soft)]" />
              {business.profileContact?.address || business.profileContact?.serviceArea || "Location available"}
            </p>
          </section>
        ) : null}
        </div>
      </div>
    </div>
  );
}
