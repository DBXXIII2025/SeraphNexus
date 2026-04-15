"use client";

import { useEffect, useMemo, useState } from "react";
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
  compact?: boolean;
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
  compact = false,
}: PublicBusinessGalleryProps) {
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
    <section
      className="business-public-surface bg-[#f5f7fb]"
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
      <div className={`mx-auto w-full max-w-[472px] px-4 ${compact ? "py-4" : "py-7 sm:py-9"}`}>
        <div className="space-y-3">
          <div className="rounded-lg border border-black/10 bg-white p-3 shadow-[0_12px_34px_rgba(15,23,42,0.08)]">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-black/10 bg-neutral-100">
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
                  style={{ fontSize: "min(var(--business-heading-size), 26px)" }}
                >
                  {businessName}
                </h1>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-black/10 bg-white p-2 shadow-[0_12px_34px_rgba(15,23,42,0.08)]">
            <div className="overflow-hidden rounded-md border border-black/10 bg-neutral-100">
              <div className="relative aspect-[4/3]">
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
                      className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md border border-blue-700 bg-blue-600 text-lg font-semibold text-white shadow-md transition hover:bg-blue-700"
                    >
                      {"<"}
                    </button>
                    <button
                      type="button"
                      onClick={() => move(1)}
                      aria-label="Next photo"
                      className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md border border-blue-700 bg-blue-600 text-lg font-semibold text-white shadow-md transition hover:bg-blue-700"
                    >
                      {">"}
                    </button>
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

          <div className="rounded-lg border border-black/10 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--business-accent)]">
                Business information
              </p>
              {images.length > 1 ? (
                <p className="text-xs text-neutral-500">
                  {activeIndex + 1} / {images.length}
                </p>
              ) : null}
            </div>
            {businessDescription ? (
              <p
                className="mt-3 whitespace-pre-wrap leading-7 text-[var(--business-text)] opacity-85"
                style={{ fontSize: "min(var(--business-body-size), 18px)" }}
              >
                {businessDescription}
              </p>
            ) : (
              <p
                className="mt-3 leading-7 text-[var(--business-text)] opacity-70"
                style={{ fontSize: "min(var(--business-body-size), 18px)" }}
              >
                Business details will appear here once the owner publishes a description.
              </p>
            )}
          </div>

          {action ? <div className="flex justify-center rounded-lg border border-black/10 bg-white p-3 shadow-[0_12px_34px_rgba(15,23,42,0.08)]">{action}</div> : null}
        </div>
      </div>
    </section>
  );
}
