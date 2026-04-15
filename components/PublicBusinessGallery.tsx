"use client";

import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type {
  BusinessPageImage,
  BusinessPageTheme,
} from "@/lib/businessPageCustomization";

type PublicBusinessGalleryProps = {
  businessName: string;
  businessDescription?: string | null;
  businessType?: string | null;
  logoUrl?: string | null;
  images: BusinessPageImage[];
  theme: BusinessPageTheme;
  action?: ReactNode;
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

export default function PublicBusinessGallery({
  businessName,
  businessDescription,
  businessType,
  logoUrl,
  images,
  theme,
  action,
}: PublicBusinessGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex] || null;
  const initials = useMemo(() => getInitials(businessName || "Business"), [businessName]);

  function move(delta: number) {
    if (images.length <= 1) {
      return;
    }
    setActiveIndex((current) => (current + delta + images.length) % images.length);
  }

  return (
    <section
      className="business-public-surface"
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
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="space-y-4">
          <div className="rounded-lg border border-black/10 bg-white p-3 shadow-sm sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-black/10 bg-neutral-100 sm:h-11 sm:w-11">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={`${businessName} logo`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-semibold tracking-[0.1em] text-neutral-700">
                      {initials}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--business-accent)]">
                    {businessType || "Business"}
                  </p>
                  <h1
                    className="mt-1 truncate font-semibold leading-tight text-[var(--business-text)]"
                    style={{ fontSize: "min(var(--business-heading-size), 28px)" }}
                  >
                    {businessName}
                  </h1>
                </div>
              </div>
              {action ? <div className="shrink-0">{action}</div> : null}
            </div>
          </div>

          <div className="w-full sm:w-[clamp(240px,24vw,320px)]">
            <div className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
              <div className="relative aspect-square bg-neutral-100">
                {activeImage ? (
                  <img
                    src={activeImage.image_url}
                    alt={activeImage.alt_text || `${businessName} photo ${activeIndex + 1}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#f8fafc,#e5e7eb)]">
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-black/10 bg-white text-base font-semibold text-neutral-700">
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
                      className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg border border-blue-200 bg-white/95 text-lg font-semibold text-blue-600 shadow-sm transition hover:bg-blue-50"
                    >
                      {"<"}
                    </button>
                    <button
                      type="button"
                      onClick={() => move(1)}
                      aria-label="Next photo"
                      className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg border border-blue-200 bg-white/95 text-lg font-semibold text-blue-600 shadow-sm transition hover:bg-blue-50"
                    >
                      {">"}
                    </button>
                    <div className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-1 text-xs text-white">
                      {activeIndex + 1} / {images.length}
                    </div>
                  </>
                ) : null}
              </div>

              {images.length > 1 ? (
                <div className="grid grid-cols-5 gap-1.5 border-t border-black/10 bg-white p-2">
                  {images.slice(0, 10).map((image, index) => (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => setActiveIndex(index)}
                      className={`aspect-square overflow-hidden rounded-md border transition ${
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

          <div className="rounded-lg border border-black/10 bg-white p-4 shadow-sm sm:max-w-3xl sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--business-accent)]">
              About
            </p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--business-text)]">
              {businessName}
            </h2>
            {businessDescription ? (
              <p
                className="mt-3 max-w-2xl leading-7 text-[var(--business-text)] opacity-80"
                style={{ fontSize: "min(var(--business-body-size), 18px)" }}
              >
                {businessDescription}
              </p>
            ) : (
              <p
                className="mt-3 max-w-2xl leading-7 text-[var(--business-text)] opacity-70"
                style={{ fontSize: "min(var(--business-body-size), 18px)" }}
              >
                Business details will appear here once the owner publishes a description.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
