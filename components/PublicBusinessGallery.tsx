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
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
          <div className="relative aspect-[16/9] min-h-[260px] bg-neutral-100 sm:min-h-[380px]">
            {activeImage ? (
              <img
                src={activeImage.image_url}
                alt={activeImage.alt_text || `${businessName} photo ${activeIndex + 1}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#f8fafc,#e5e7eb)]">
                <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-black/10 bg-white text-xl font-semibold text-neutral-700">
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
                  className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg bg-white/90 text-2xl text-neutral-900 shadow transition hover:bg-white"
                >
                  {"<"}
                </button>
                <button
                  type="button"
                  onClick={() => move(1)}
                  aria-label="Next photo"
                  className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg bg-white/90 text-2xl text-neutral-900 shadow transition hover:bg-white"
                >
                  {">"}
                </button>
                <div className="absolute bottom-3 right-3 rounded-lg bg-black/70 px-3 py-1 text-sm text-white">
                  {activeIndex + 1} / {images.length}
                </div>
              </>
            ) : null}
          </div>

          {images.length > 1 ? (
            <div className="grid grid-cols-4 gap-2 border-t border-black/10 bg-white p-2 sm:grid-cols-6">
              {images.slice(0, 12).map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`aspect-[4/3] overflow-hidden rounded-md border transition ${
                    index === activeIndex
                      ? "border-[var(--business-accent)]"
                      : "border-transparent opacity-80 hover:opacity-100"
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

          <div className="grid gap-5 p-5 sm:grid-cols-[1fr,auto] sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-black/10 bg-neutral-100">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={`${businessName} logo`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-semibold tracking-[0.12em] text-neutral-700">
                    {initials}
                  </span>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--business-accent)]">
                  {businessType || "Business"}
                </p>
                <h1
                  className="mt-2 font-semibold leading-tight text-[var(--business-text)]"
                  style={{ fontSize: "var(--business-heading-size)" }}
                >
                  {businessName}
                </h1>
                {businessDescription ? (
                  <p
                    className="mt-3 max-w-3xl leading-7 text-[var(--business-text)] opacity-80"
                    style={{ fontSize: "var(--business-body-size)" }}
                  >
                    {businessDescription}
                  </p>
                ) : null}
              </div>
            </div>
            {action ? <div className="sm:self-start">{action}</div> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
