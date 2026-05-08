"use client";

import Link from "next/link";
import { formatBusinessType, type BusinessViewModel } from "../exploreData";
import { trackLeadEvent } from "@/lib/leadTracker";

function getSummary(business: BusinessViewModel) {
  const summary = business.displayDescription?.trim() || business.routeSummary;
  return summary.length > 118 ? `${summary.slice(0, 115).trimEnd()}...` : summary;
}

function getActionLabel(business: BusinessViewModel) {
  switch (business.routeState.routeId) {
    case "book":
      return "Book";
    case "rent":
      return "Rent";
    case "order":
      return "Order";
    case "shop":
      return "Shop";
    default:
      return "View";
  }
}

export default function ExploreBusinessCard({
  business,
}: {
  business: BusinessViewModel;
}) {
  const summary = getSummary(business);
  const actionLabel = getActionLabel(business);
  const action =
    actionLabel === "Book" ? "book" : actionLabel === "Rent" ? "rent" : actionLabel === "Order" ? "order" : actionLabel === "Shop" ? "shop" : "view";

  function handleBusinessClick() {
    void trackLeadEvent({
      businessId: business.id,
      eventType: "business_click",
      source: "explore",
      metadata: {
        page: "/explore",
        action: business.routeState.routeId,
        slug: business.slug,
      },
    });
  }

  function handleCtaClick() {
    void trackLeadEvent({
      businessId: business.id,
      eventType: "cta_click",
      source: "explore",
      metadata: {
        page: "/explore",
        action,
        slug: business.slug,
      },
    });
  }

  return (
    <article className="explore-market-card group transition duration-200 hover:-translate-y-0.5 hover:border-[rgba(212,175,55,0.18)] hover:shadow-[0_12px_22px_rgba(0,0,0,0.28)]">
      <Link
        href={business.routeState.href}
        onClick={handleBusinessClick}
        className="block no-underline"
      >
        <div className="relative h-[116px] overflow-hidden border-b border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)]">
          {business.thumbnailUrl ? (
            <img
              src={business.thumbnailUrl}
              alt={`${business.displayName} logo`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(180deg,rgba(212,175,55,0.08),rgba(255,255,255,0.02))]">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(212,175,55,0.18)] bg-[rgba(255,255,255,0.03)] text-sm font-semibold uppercase tracking-[0.08em] text-[var(--accent-soft)]">
                {business.initials}
              </span>
            </div>
          )}

          <div className="absolute left-2.5 top-2.5 inline-flex items-center rounded-full border border-[rgba(212,175,55,0.18)] bg-[rgba(11,12,14,0.8)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.11em] text-[var(--accent-soft)]">
            {formatBusinessType(business.business_type)}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-3">
          <div className="space-y-1">
            <h3 className="line-clamp-1 text-[0.93rem] font-semibold leading-5 text-[var(--text-strong)]">
              {business.displayName}
            </h3>
            {business.serviceCategoryLabel ? (
              <span className="inline-flex rounded-full border border-[rgba(212,175,55,0.18)] bg-[rgba(255,255,255,0.02)] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--accent-soft)]">
                {business.serviceCategoryLabel}
              </span>
            ) : null}
            <p className="line-clamp-2 text-[12px] leading-[1.35] text-[var(--text-soft)]">
              {summary}
            </p>
          </div>
        </div>
      </Link>

      <div className="px-3 pb-3">
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="rounded-full border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--text-muted)]">
            {actionLabel}
          </span>

          <Link
            href={business.routeState.href}
            onClick={handleCtaClick}
            className="inline-flex min-h-[32px] items-center justify-center rounded-full border border-[rgba(212,175,55,0.32)] bg-[linear-gradient(180deg,#e6c76a,#d4af37)] px-3 text-[12px] font-semibold text-[var(--accent-contrast)] no-underline"
          >
            {actionLabel}
          </Link>
        </div>
      </div>
    </article>
  );
}
