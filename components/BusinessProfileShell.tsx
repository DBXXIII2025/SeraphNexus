"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type {
  BusinessPageImage,
  BusinessPageTheme,
} from "@/lib/businessPageCustomization";

type BusinessProfileShellProps = {
  businessName: string;
  businessDescription?: string | null;
  businessType?: string | null;
  logoUrl?: string | null;
  images: BusinessPageImage[];
  theme: BusinessPageTheme;
  action?: ReactNode;
  compact?: boolean;
  contact?: {
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

function getInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "BN"
  );
}

export default function BusinessProfileShell({
  businessName,
  businessDescription,
  businessType,
  logoUrl,
  images: incomingImages,
  theme,
  action,
  compact = false,
  contact,
}: BusinessProfileShellProps) {
  const images = useMemo(
    () =>
      Array.isArray(incomingImages)
        ? incomingImages.filter((image) => Boolean(image?.image_url))
        : [],
    [incomingImages]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex] || null;
  const initials = useMemo(() => getInitials(businessName || "Business"), [businessName]);
  const hasContactInfo = Boolean(
    contact?.phone || contact?.email || contact?.website || contact?.address
    || contact?.serviceArea || contact?.facebook || contact?.instagram || contact?.twitter
  );

  useEffect(() => {
    if (activeIndex > 0 && activeIndex >= images.length) {
      setActiveIndex(Math.max(0, images.length - 1));
    }
  }, [activeIndex, images.length]);

  function showPreviousImage() {
    if (images.length <= 1) {
      return;
    }
    setActiveIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  }

  function showNextImage() {
    if (images.length <= 1) {
      return;
    }
    setActiveIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  }

  return (
    <article
      className={`mx-auto w-full ${compact ? "max-w-[390px] space-y-3" : "max-w-5xl space-y-5"}`}
      style={
        {
          width: "100%",
          "--business-accent": theme.accentColor,
          "--business-text": theme.textColor,
          "--business-background": theme.backgroundColor,
          "--business-heading-size": `${theme.headingFontSize}px`,
          "--business-body-size": `${theme.bodyFontSize}px`,
          "--business-accent-text": theme.accentTextColor,
        } as CSSProperties
      }
    >
      <header className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-[0_14px_34px_rgba(15,23,42,0.10)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-950 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
              SN
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">Seraph Nexus</p>
              <p className="text-xs text-slate-500">Business profile</p>
            </div>
          </div>
          <nav className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <a href="/explore" className="rounded-md border border-slate-200 px-3 py-2 hover:border-slate-400">
              Explore
            </a>
            <span className="hidden rounded-md border border-slate-200 px-3 py-2 sm:inline-flex">
              {businessType || "Business"}
            </span>
          </nav>
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_18px_44px_rgba(15,23,42,0.10)]">
        <div className={compact ? "flex min-w-0 items-center gap-3" : "grid gap-4 sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:items-center"}>
          <div
            className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow-inner"
            style={{
              width: compact ? "44px" : "64px",
              height: compact ? "44px" : "64px",
              minWidth: compact ? "44px" : "64px",
              minHeight: compact ? "44px" : "64px",
              maxWidth: "64px",
              maxHeight: "64px",
            }}
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${businessName} logo`}
                className="h-full w-full object-cover"
                style={{
                  width: "100%",
                  height: "100%",
                  maxWidth: "64px",
                  maxHeight: "64px",
                  objectFit: "cover",
                }}
              />
            ) : (
              <span className="text-[11px] font-semibold tracking-[0.1em] text-slate-700">
                {initials}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--business-accent)]">
              {businessType || "Business"}
            </p>
            <h1
              className="mt-1 font-semibold leading-tight text-[var(--business-text)]"
              style={{ fontSize: compact ? "min(var(--business-heading-size), 22px)" : "min(var(--business-heading-size), 34px)" }}
            >
              {businessName}
            </h1>
            {businessDescription ? (
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                {businessDescription}
              </p>
            ) : null}
          </div>
          {action ? <div className={compact ? "hidden" : "sm:justify-self-end"}>{action}</div> : null}
        </div>
      </section>

      <section
        className="rounded-lg border border-slate-200 bg-white p-2 shadow-[0_14px_32px_rgba(15,23,42,0.12)]"
        style={{ width: "100%", maxWidth: compact ? "380px" : "760px", marginInline: "auto" }}
      >
        <div className="mb-1.5 flex items-center justify-between px-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Gallery
          </p>
          <p className="text-[11px] font-medium text-slate-500">
            {images.length > 0 ? `${activeIndex + 1} / ${images.length}` : "No photos"}
          </p>
        </div>
        <div
          className="overflow-hidden rounded-md border border-slate-200 bg-slate-100 shadow-inner"
          style={{ width: "100%" }}
        >
          <div
            className="relative aspect-[1.2/1]"
            style={{
              width: "100%",
              aspectRatio: "1.2 / 1",
              maxHeight: compact ? "300px" : "520px",
            }}
          >
            {activeImage ? (
              <img
                src={activeImage.image_url}
                alt={activeImage.alt_text || `${businessName} photo ${activeIndex + 1}`}
                className="h-full w-full object-cover"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#f8fafc,#e5e7eb)]">
                <div className="flex h-16 w-16 items-center justify-center rounded-md border border-slate-300 bg-white text-base font-semibold text-slate-700">
                  {initials}
                </div>
              </div>
            )}

            {images.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={showPreviousImage}
                  aria-label="Previous photo"
                  className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md border border-blue-700 bg-blue-600 text-base font-semibold text-white shadow-[0_6px_14px_rgba(37,99,235,0.35)] transition hover:bg-blue-700"
                >
                  {"<"}
                </button>
                <button
                  type="button"
                  onClick={showNextImage}
                  aria-label="Next photo"
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md border border-blue-700 bg-blue-600 text-base font-semibold text-white shadow-[0_6px_14px_rgba(37,99,235,0.35)] transition hover:bg-blue-700"
                >
                  {">"}
                </button>
              </>
            ) : null}
          </div>

          {images.length > 1 ? (
            <div className="grid grid-cols-5 gap-1 border-t border-slate-300 bg-white p-1.5 sm:grid-cols-8">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`aspect-square overflow-hidden rounded border transition ${
                    index === activeIndex
                      ? "border-[var(--business-accent)]"
                      : "border-transparent opacity-75 hover:opacity-100"
                  }`}
                >
                  <img
                    src={image.image_url}
                    alt={image.alt_text || `${businessName} thumbnail ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.10)]">
        <div className="border-b border-slate-200 pb-2">
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--business-accent)]">
            Business information
          </p>
          <h2 className="mt-1 truncate text-base font-semibold leading-tight text-[var(--business-text)]">
            {businessName}
          </h2>
        </div>
        {businessDescription ? (
          <p
            className="mt-2.5 whitespace-pre-wrap leading-6 text-[var(--business-text)] opacity-85"
            style={{ fontSize: "min(var(--business-body-size), 15px)" }}
          >
            {businessDescription}
          </p>
        ) : (
          <p
            className="mt-2.5 leading-6 text-[var(--business-text)] opacity-70"
            style={{ fontSize: "min(var(--business-body-size), 15px)" }}
          >
            Business details will appear here once the owner publishes a description.
          </p>
        )}
        {compact && action ? <div className="mt-2.5 border-t border-slate-200 pt-2.5">{action}</div> : null}
        {hasContactInfo ? (
          <div className="mt-4 grid gap-2 border-t border-slate-200 pt-4 text-sm text-slate-700 sm:grid-cols-2">
            {contact?.phone ? <p><span className="font-semibold">Phone:</span> {contact.phone}</p> : null}
            {contact?.email ? <p><span className="font-semibold">Email:</span> {contact.email}</p> : null}
            {contact?.website ? <p><span className="font-semibold">Website:</span> {contact.website}</p> : null}
            {contact?.address ? <p><span className="font-semibold">Address:</span> {contact.address}</p> : null}
            {contact?.serviceArea ? <p><span className="font-semibold">Service area:</span> {contact.serviceArea}</p> : null}
            {contact?.facebook ? <p><span className="font-semibold">Facebook:</span> {contact.facebook}</p> : null}
            {contact?.instagram ? <p><span className="font-semibold">Instagram:</span> {contact.instagram}</p> : null}
            {contact?.twitter ? <p><span className="font-semibold">Twitter/X:</span> {contact.twitter}</p> : null}
          </div>
        ) : null}
      </section>

      <footer className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-slate-950">{businessName}</p>
            <p className="text-xs text-slate-500">Published on Seraph Nexus</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/explore" className="rounded-md border border-slate-200 px-3 py-2 font-medium text-slate-700">
              Explore
            </a>
            <a href="/legal/terms_of_service" className="rounded-md border border-slate-200 px-3 py-2 font-medium text-slate-700">
              Terms
            </a>
            <a href="/legal/privacy_policy" className="rounded-md border border-slate-200 px-3 py-2 font-medium text-slate-700">
              Privacy
            </a>
            {action ? <div>{action}</div> : null}
          </div>
        </div>
      </footer>
    </article>
  );
}
