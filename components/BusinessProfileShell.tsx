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
};

function Marker({ label }: { label: string }) {
  return (
    <span className="mb-1 inline-flex rounded bg-fuchsia-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
      {label}
    </span>
  );
}

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
  images,
  theme,
  action,
  compact = false,
}: BusinessProfileShellProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex] || null;
  const initials = useMemo(() => getInitials(businessName || "Business"), [businessName]);

  useEffect(() => {
    if (activeIndex > 0 && activeIndex >= images.length) {
      setActiveIndex(Math.max(0, images.length - 1));
    }
  }, [activeIndex, images.length]);

  function move(delta: number) {
    if (images.length <= 1) {
      return;
    }
    setActiveIndex((current) => (current + delta + images.length) % images.length);
  }

  return (
    <div
      data-layout-marker="PROFILE_SHELL"
      className={`mx-auto w-full max-w-[392px] border-2 border-fuchsia-500 bg-fuchsia-50/50 p-1 ${compact ? "space-y-2" : "space-y-2.5"}`}
      style={
        {
          "--business-accent": theme.accentColor,
          "--business-text": theme.textColor,
          "--business-heading-size": `${theme.headingFontSize}px`,
          "--business-body-size": `${theme.bodyFontSize}px`,
          "--business-accent-text": theme.accentTextColor,
        } as CSSProperties
      }
    >
      <Marker label="PROFILE_SHELL" />
      <div
        data-layout-marker="HEADER_CARD"
        className="rounded-lg border-2 border-cyan-500 bg-white p-2.5 shadow-[0_8px_22px_rgba(15,23,42,0.12)]"
      >
        <Marker label="HEADER_CARD" />
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-300 bg-slate-100 shadow-inner">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${businessName} logo`}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xs font-semibold tracking-[0.1em] text-slate-700">
                {initials}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--business-accent)]">
              {businessType || "Business"}
            </p>
            <h1
              className="mt-1 truncate font-semibold leading-tight text-[var(--business-text)]"
              style={{ fontSize: "min(var(--business-heading-size), 24px)" }}
            >
              {businessName}
            </h1>
          </div>
        </div>
      </div>

      <div
        data-layout-marker="GALLERY_CARD"
        className="rounded-lg border-2 border-blue-500 bg-white p-2 shadow-[0_8px_22px_rgba(15,23,42,0.12)]"
      >
        <Marker label="GALLERY_CARD" />
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Gallery
          </p>
          <p className="text-[11px] font-medium text-slate-500">
            {images.length > 0 ? `${activeIndex + 1} / ${images.length}` : "No photos"}
          </p>
        </div>
        <div className="overflow-hidden rounded-md border border-slate-400 bg-slate-100 shadow-inner">
          <div className="relative aspect-[1.28/1]">
            {activeImage ? (
              <img
                src={activeImage.image_url}
                alt={activeImage.alt_text || `${businessName} photo ${activeIndex + 1}`}
                className="h-full w-full object-cover"
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
                  onClick={() => move(-1)}
                  aria-label="Previous photo"
                  className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md border border-blue-700 bg-blue-600 text-lg font-semibold text-white shadow-[0_6px_14px_rgba(37,99,235,0.35)] transition hover:bg-blue-700"
                >
                  {"<"}
                </button>
                <button
                  type="button"
                  onClick={() => move(1)}
                  aria-label="Next photo"
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md border border-blue-700 bg-blue-600 text-lg font-semibold text-white shadow-[0_6px_14px_rgba(37,99,235,0.35)] transition hover:bg-blue-700"
                >
                  {">"}
                </button>
              </>
            ) : null}
          </div>

          {images.length > 1 ? (
            <div className="grid grid-cols-5 gap-1.5 border-t border-slate-300 bg-white p-2">
              {images.slice(0, 10).map((image, index) => (
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
      </div>

      <div
        data-layout-marker="INFO_CARD"
        className="rounded-lg border-2 border-emerald-500 bg-white p-3.5 shadow-[0_8px_22px_rgba(15,23,42,0.12)]"
      >
        <Marker label="INFO_CARD" />
        <div className="border-b border-slate-200 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--business-accent)]">
            Business information
          </p>
          <h2 className="mt-1 truncate text-base font-semibold leading-tight text-[var(--business-text)]">
            {businessName}
          </h2>
        </div>
        {businessDescription ? (
          <p
            className="mt-3 whitespace-pre-wrap leading-6 text-[var(--business-text)] opacity-85"
            style={{ fontSize: "min(var(--business-body-size), 16px)" }}
          >
            {businessDescription}
          </p>
        ) : (
          <p
            className="mt-3 leading-6 text-[var(--business-text)] opacity-70"
            style={{ fontSize: "min(var(--business-body-size), 16px)" }}
          >
            Business details will appear here once the owner publishes a description.
          </p>
        )}
        {action ? <div className="mt-3 border-t border-slate-200 pt-3">{action}</div> : null}
      </div>
    </div>
  );
}
