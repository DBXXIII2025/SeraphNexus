"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type {
  BusinessPageImage,
  BusinessPageTheme,
} from "@/lib/businessPageCustomization";
import {
  PublicHero,
  PublicSection,
  PublicSiteShell,
  PublicTopNav,
} from "@/components/public/PublicLayoutSystem";

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
    contact?.phone ||
      contact?.email ||
      contact?.website ||
      contact?.address ||
      contact?.serviceArea ||
      contact?.facebook ||
      contact?.instagram ||
      contact?.twitter
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
    <PublicSiteShell
      className={`public-business-page ${compact ? "public-business-page-compact" : ""}`}
    >
      <article
        className={`public-profile-shell ${compact ? "public-profile-shell-compact" : "public-profile-shell-full"}`}
        data-theme-background={theme.backgroundColor}
        data-theme-accent={theme.accentColor}
        data-theme-text={theme.textColor}
      >
      <PublicTopNav
        brand="Seraph Nexus"
        initials="SN"
        actions={
          <>
            <Link href="/explore" className="public-action-secondary">Explore</Link>
            <span className="public-chip">{businessType || "Business"}</span>
          </>
        }
      />

      <PublicHero
        eyebrow={businessType || "Business"}
        title={businessName}
        description={businessDescription || null}
        meta={
          <div
            className="public-card-mark overflow-hidden"
            style={{
              width: compact ? "44px" : "56px",
              height: compact ? "44px" : "56px",
            }}
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${businessName} logo`}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{initials}</span>
            )}
          </div>
        }
      />

      <PublicSection
        title="Gallery"
        description={images.length > 0 ? `${activeIndex + 1} / ${images.length}` : "No photos"}
      >
        <div className="public-gallery-frame">
          <div className="relative aspect-[1.2/1]">
            {activeImage ? (
              <img
                src={activeImage.image_url}
                alt={activeImage.alt_text || `${businessName} photo ${activeIndex + 1}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span>{initials}</span>
              </div>
            )}

            {images.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={showPreviousImage}
                  aria-label="Previous photo"
                  className="public-gallery-button public-gallery-button-left"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={showNextImage}
                  aria-label="Next photo"
                  className="public-gallery-button public-gallery-button-right"
                >
                  Next
                </button>
              </>
            ) : null}
          </div>

          {images.length > 1 ? (
            <div className="grid grid-cols-5 gap-1 border-t p-1 sm:grid-cols-8">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-label={`Show photo ${index + 1}`}
                  className="aspect-square overflow-hidden border p-0"
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
      </PublicSection>

      <PublicSection title="Business information" eyebrow={businessName}>
        {businessDescription ? (
          <p className="whitespace-pre-wrap">{businessDescription}</p>
        ) : (
          <p>Business details will appear here once the owner publishes a description.</p>
        )}
      </PublicSection>

      {hasContactInfo ? (
        <PublicSection
          title="Contact"
          description="Use the business contact details published by the owner."
        >
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            {contact?.phone ? (
              <div>
                <dt>Phone</dt>
                <dd>
                  {phoneHref(contact.phone) ? (
                    <a href={phoneHref(contact.phone) || undefined}>{contact.phone}</a>
                  ) : (
                    contact.phone
                  )}
                </dd>
              </div>
            ) : null}
            {contact?.email ? (
              <div>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${contact.email}`}>{contact.email}</a>
                </dd>
              </div>
            ) : null}
            {contact?.website ? (
              <div>
                <dt>Website</dt>
                <dd>
                  <a href={externalHref(contact.website)} rel="noreferrer" target="_blank">
                    {contact.website}
                  </a>
                </dd>
              </div>
            ) : null}
            {contact?.address ? (
              <div>
                <dt>Address</dt>
                <dd className="whitespace-pre-wrap">{contact.address}</dd>
              </div>
            ) : null}
            {contact?.serviceArea ? (
              <div>
                <dt>Service area</dt>
                <dd>{contact.serviceArea}</dd>
              </div>
            ) : null}
            {contact?.facebook ? (
              <div>
                <dt>Facebook</dt>
                <dd>
                  <a href={externalHref(contact.facebook)} rel="noreferrer" target="_blank">
                    {contact.facebook}
                  </a>
                </dd>
              </div>
            ) : null}
            {contact?.instagram ? (
              <div>
                <dt>Instagram</dt>
                <dd>
                  <a href={externalHref(contact.instagram)} rel="noreferrer" target="_blank">
                    {contact.instagram}
                  </a>
                </dd>
              </div>
            ) : null}
            {contact?.twitter ? (
              <div>
                <dt>Twitter/X</dt>
                <dd>
                  <a href={externalHref(contact.twitter)} rel="noreferrer" target="_blank">
                    {contact.twitter}
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
        </PublicSection>
      ) : null}

      {action ? (
        <PublicSection title="Get started">
          <div className="mt-3">{action}</div>
        </PublicSection>
      ) : null}

      <footer className="public-section">
        <p>{businessName}</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/explore">Explore</Link>
          <Link href="/legal/terms_of_service">Terms</Link>
          <Link href="/legal/privacy_policy">Privacy</Link>
        </div>
        <p className="mt-2">Business information is provided by the business owner.</p>
      </footer>
      </article>
    </PublicSiteShell>
  );
}
