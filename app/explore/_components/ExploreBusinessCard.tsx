"use client";

import Image from "next/image";
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
    <article className="group flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-[#352b43] bg-[#15111e] shadow-[0_12px_28px_-25px_rgba(30,50,35,0.35)] transition duration-200 hover:-translate-y-1 hover:border-[#9873d2] hover:shadow-lg">
      <Link
        href={business.routeState.href}
        onClick={handleBusinessClick}
        className="block flex-1 no-underline"
      >
        <div className="relative h-44 overflow-hidden border-b border-[#352b43] bg-[#20172c]">
          {business.thumbnailUrl ? (
            <Image
              src={business.thumbnailUrl}
              alt={`${business.displayName} logo`}
              fill
              sizes="(min-width: 768px) 25vw, 100vw"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#251b33]">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#4a3b60] bg-[#15111e] text-sm font-semibold uppercase tracking-[0.08em] text-[#c5a4ff]">
                {business.initials}
              </span>
            </div>
          )}

          <div className="absolute left-2.5 top-2.5 inline-flex items-center rounded-full border border-[#352b43] bg-[#15111e] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.11em] text-[var(--accent-soft)]">
            {formatBusinessType(business.business_type)}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-3">
          <div className="space-y-1">
            <h3 className="line-clamp-1 text-[0.93rem] font-semibold leading-5 text-[#f5f1fa]">
              {business.displayName}
            </h3>
            {business.serviceCategoryLabel ? (
              <span className="inline-flex rounded-full border border-[rgba(197,164,255,0.18)] bg-[#251b33] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--accent-soft)]">
                {business.serviceCategoryLabel}
              </span>
            ) : null}
            <p className="line-clamp-2 text-[12px] leading-[1.35] text-[#c1b8cd]">
              {summary}
            </p>
          </div>
        </div>
      </Link>

      <div className="px-3 pb-3">
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="rounded-full border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-[#c1b8cd]">
            {actionLabel}
          </span>

          <Link
            href={business.routeState.href}
            onClick={handleCtaClick}
            className="inline-flex min-h-[32px] items-center justify-center rounded-full border border-[rgba(197,164,255,0.32)] bg-[#c5a4ff] px-3 text-[12px] font-semibold text-[#170e24] no-underline"
          >
            {actionLabel}
          </Link>
        </div>
      </div>
    </article>
  );
}
