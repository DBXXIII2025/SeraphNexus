"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import MessageBusinessButton from "@/components/MessageBusinessButton";
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

function externalHref(value: string) {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function phoneHref(value: string) {
  const normalized = value.replace(/[^\d+]/g, "");
  return normalized ? `tel:${normalized}` : null;
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
  const galleryImages = useMemo(
    () => business.galleryImages.filter((image) => Boolean(image?.image_url)),
    [business.galleryImages]
  );
  const [activeImageIndex, setActiveImageIndex] = useState(0);
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
  const mapEmbedUrl = useMemo(() => {
    const query = business.mapQuery?.trim();
    return query ? `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed` : null;
  }, [business.mapQuery]);
  const mapExternalUrl = useMemo(() => {
    const query = business.mapQuery?.trim();
    return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
  }, [business.mapQuery]);
  const activeImage = galleryImages[activeImageIndex] || galleryImages[0] || null;
  const businessInitials = useMemo(
    () =>
      (business.name || "Business")
        .split(/\s+/)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("")
        .slice(0, 2) || "BN",
    [business.name]
  );
  const hasContactInfo = Boolean(
    business.profileContact?.phone ||
      business.profileContact?.email ||
      business.profileContact?.website ||
      business.profileContact?.address ||
      business.profileContact?.serviceArea
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

  useEffect(() => {
    if (activeImageIndex > 0 && activeImageIndex >= galleryImages.length) {
      setActiveImageIndex(Math.max(0, galleryImages.length - 1));
    }
  }, [activeImageIndex, galleryImages.length]);

  function showPreviousImage() {
    if (galleryImages.length <= 1) {
      return;
    }
    setActiveImageIndex((prev) => (prev === 0 ? galleryImages.length - 1 : prev - 1));
  }

  function showNextImage() {
    if (galleryImages.length <= 1) {
      return;
    }
    setActiveImageIndex((prev) => (prev === galleryImages.length - 1 ? 0 : prev + 1));
  }

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
          type: "rental",
          business_id: business.id,
          item_id: selectedPropertyId,
          price: Number(selectedProperty?.price || 0),
          metadata: {
            customer: {
              name: customerName,
              email,
              phone,
            },
            check_in: startDate,
            check_out: endDate,
            timezone: timeZone,
          },
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
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="border-b border-[var(--border-soft)] pb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-[var(--border-soft)] bg-[var(--accent-muted)] text-sm font-semibold text-[var(--accent)]">
                {business.logo_url ? (
                  <img
                    src={business.logo_url}
                    alt={`${business.name} logo`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  businessInitials
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {business.platformBrand?.siteName || "Seraph Nexus"}
                </p>
                <h1 className="text-lg font-semibold text-[var(--text-strong)]">{business.name}</h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/explore" className="text-sm font-medium text-[var(--text-soft)] underline-offset-4 hover:underline">
                Explore
              </Link>
              <MessageBusinessButton
                businessId={business.id}
                className="btn-primary inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium"
              />
            </div>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.7fr)]">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent-soft)]">
                {business.business_type === "property" ? t("propertyStays") : t("rentalInventory")}
              </p>
              <div className="space-y-3">
                <h2 className="max-w-3xl text-4xl font-semibold leading-tight text-[var(--text-strong)] sm:text-5xl">
                  {selectedProperty?.name || business.name}
                </h2>
                <p className="max-w-2xl text-base leading-7 text-[var(--text-soft)]">
                  {selectedProperty?.description || business.description || "Browse available stays and reserve directly online."}
                </p>
              </div>
            </div>

            <div className="border-t border-[var(--border-soft)] pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Selected stay
              </p>
              <div className="mt-3 flex items-end justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-[var(--text-strong)]">
                    {selectedProperty?.name || "Choose a listing"}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">
                    Reserve available dates directly from the public listing page.
                  </p>
                </div>
                {selectedProperty ? (
                  <p className="text-lg font-semibold text-[var(--text-strong)]">
                    ${Number(selectedProperty.price || 0).toFixed(2)}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        {activeImage ? (
          <section className="border-b border-[var(--border-soft)] py-8">
            <div className="public-gallery-frame">
              <div className="relative aspect-[1.2/1]">
                <img
                  src={activeImage.image_url}
                  alt={activeImage.alt_text || `${business.name} photo`}
                  className="h-full w-full object-cover"
                />

                {galleryImages.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={showPreviousImage}
                      aria-label="Previous photo"
                      className="public-gallery-button public-gallery-button-left"
                    >
                      &#8249;
                    </button>
                    <button
                      type="button"
                      onClick={showNextImage}
                      aria-label="Next photo"
                      className="public-gallery-button public-gallery-button-right"
                    >
                      &#8250;
                    </button>
                  </>
                ) : null}
              </div>
            </div>
            {galleryImages.length > 1 ? (
              <div className="mt-4 grid grid-cols-5 gap-1 border-t border-[var(--border-soft)] p-1 sm:grid-cols-8">
                {galleryImages.map((image, index) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => setActiveImageIndex(index)}
                    aria-label={`Show photo ${index + 1}`}
                    className={`aspect-square overflow-hidden border p-0 text-left ${
                      index === activeImageIndex
                        ? "border-[var(--accent)]"
                        : "border-[var(--border-soft)] opacity-80 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={image.image_url}
                      alt={image.alt_text || `${business.name} thumbnail ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <div className="grid gap-10 py-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.8fr)]">
          <main className="min-w-0">
            <section className="border-b border-[var(--border-soft)] pb-8">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Inventory
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">
                    Available {business.business_type === "property" ? "properties" : "rentals"}
                  </h2>
                </div>
                <p className="text-sm text-[var(--text-soft)]">
                  Select a listing to review details and reserve dates.
                </p>
              </div>

              {!properties || properties.length === 0 ? (
                <p className="mt-6 text-sm text-[var(--text-soft)]">No rental items have been added yet.</p>
              ) : (
                <div className="mt-6 divide-y divide-[var(--border-soft)]">
                  {properties.map((property) => {
                    const selected = property.id === selectedPropertyId;

                    return (
                      <button
                        key={property.id}
                        type="button"
                        onClick={() => {
                          setSelectedPropertyId(property.id);
                          void refreshAvailability(property.id);
                        }}
                        className={`w-full px-0 py-5 text-left transition ${
                          selected ? "text-[var(--text-strong)]" : "text-[var(--text-main)]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <span
                                className={`h-2.5 w-2.5 rounded-full ${
                                  selected ? "bg-[var(--accent)]" : "bg-[var(--border-soft)]"
                                }`}
                              />
                              <h3 className="text-lg font-semibold">{property.name}</h3>
                            </div>
                            <p className="max-w-2xl text-sm leading-6 text-[var(--text-soft)]">
                              {property.description || "Private listing details available after booking."}
                            </p>
                          </div>
                          <p className="whitespace-nowrap text-base font-semibold text-[var(--text-strong)]">
                            ${Number(property.price || 0).toFixed(2)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {selectedProperty ? (
              <section className="border-b border-[var(--border-soft)] py-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      Listing details
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">
                      {selectedProperty.name}
                    </h2>
                  </div>
                  <p className="text-base font-semibold text-[var(--text-strong)]">
                    ${Number(selectedProperty.price || 0).toFixed(2)}
                  </p>
                </div>

                {selectedProperty.description ? (
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--text-soft)]">
                    {selectedProperty.description}
                  </p>
                ) : null}

              </section>
            ) : null}

            {(hasContactInfo || mapEmbedUrl) && (
              <section className="py-8">
                <div className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                  {hasContactInfo ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        Contact
                      </p>
                      <div className="mt-4 space-y-3 text-sm text-[var(--text-soft)]">
                        {business.profileContact?.phone ? (
                          <p>
                            <span className="font-medium text-[var(--text-main)]">Phone:</span>{" "}
                            {phoneHref(business.profileContact.phone) ? (
                              <a
                                href={phoneHref(business.profileContact.phone) || undefined}
                                className="underline-offset-4 hover:underline"
                              >
                                {business.profileContact.phone}
                              </a>
                            ) : (
                              business.profileContact.phone
                            )}
                          </p>
                        ) : null}
                        {business.profileContact?.email ? (
                          <p>
                            <span className="font-medium text-[var(--text-main)]">Email:</span>{" "}
                            <a
                              href={`mailto:${business.profileContact.email}`}
                              className="underline-offset-4 hover:underline"
                            >
                              {business.profileContact.email}
                            </a>
                          </p>
                        ) : null}
                        {business.profileContact?.website ? (
                          <p>
                            <span className="font-medium text-[var(--text-main)]">Website:</span>{" "}
                            <a
                              href={externalHref(business.profileContact.website)}
                              target="_blank"
                              rel="noreferrer"
                              className="underline-offset-4 hover:underline"
                            >
                              {business.profileContact.website}
                            </a>
                          </p>
                        ) : null}
                        {business.profileContact?.address ? (
                          <p>
                            <span className="font-medium text-[var(--text-main)]">Address:</span>{" "}
                            {business.profileContact.address}
                          </p>
                        ) : null}
                        {business.profileContact?.serviceArea ? (
                          <p>
                            <span className="font-medium text-[var(--text-main)]">Service area:</span>{" "}
                            {business.profileContact.serviceArea}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {mapEmbedUrl ? (
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                            Location
                          </p>
                          <p className="mt-2 text-sm text-[var(--text-soft)]">
                            Explore the area around this {business.business_type === "property" ? "property" : "rental"}.
                          </p>
                        </div>
                        {mapExternalUrl ? (
                          <a
                            href={mapExternalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-medium text-[var(--text-soft)] underline-offset-4 hover:underline"
                          >
                            Open map
                          </a>
                        ) : null}
                      </div>
                      <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border-soft)]">
                        <iframe
                          title={`${business.name} location map`}
                          src={mapEmbedUrl}
                          className="h-[320px] w-full border-0"
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>
            )}
          </main>

          <aside className="min-w-0">
            <div className="border-t border-[var(--border-soft)] pt-5 lg:sticky lg:top-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {t("reserveDates")}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">
                Book this stay
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                Future dates remain bookable unless they are manually blocked or already reserved.
              </p>

              {selectedProperty ? (
                <div className="mt-5 flex items-end justify-between gap-3 border-b border-[var(--border-soft)] pb-4">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-main)]">{selectedProperty.name}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Complete your guest details to continue to checkout.
                    </p>
                  </div>
                  <p className="text-base font-semibold text-[var(--text-strong)]">
                    ${Number(selectedProperty.price || 0).toFixed(2)}
                  </p>
                </div>
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
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Unavailable dates
                </p>
                {selectedProperty && unavailableDates.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--text-soft)]">
                    No blocked or booked dates currently published for this listing.
                  </p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {unavailableDates.slice(0, 20).map((date) => (
                      <span
                        key={date}
                        className="rounded-full border border-[var(--border-soft)] px-3 py-1 text-xs text-[var(--text-soft)]"
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
          </aside>
        </div>
      </div>
    </div>
  );
}
