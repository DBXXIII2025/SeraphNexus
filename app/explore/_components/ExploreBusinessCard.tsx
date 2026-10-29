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
    <article className="group flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-[#e1e5da] bg-white shadow-[0_12px_28px_-25px_rgba(30,50,35,0.35)] transition duration-200 hover:-translate-y-1 hover:border-[#c8d6c5] hover:shadow-lg">
      <Link
        href={business.routeState.href}
        onClick={handleBusinessClick}
        className="block flex-1 no-underline"
      >
        <div className="relative h-44 overflow-hidden border-b border-[#e4e8dc] bg-[#eaf0e6]">
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
            <div className="flex h-full w-full items-center justify-center bg-[#e8eee4]">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#cdd8c8] bg-white text-sm font-semibold uppercase tracking-[0.08em] text-[#806e36]">
                {business.initials}
              </span>
            </div>
          )}

          <div className="absolute left-2.5 top-2.5 inline-flex items-center rounded-full border border-[#dfe3d6] bg-white/95 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.11em] text-[var(--accent-soft)]">
            {formatBusinessType(business.business_type)}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-3">
          <div className="space-y-1">
            <h3 className="line-clamp-1 text-[0.93rem] font-semibold leading-5 text-[#29332c]">
              {business.displayName}
            </h3>
            {business.serviceCategoryLabel ? (
              <span className="inline-flex rounded-full border border-[rgba(212,175,55,0.18)] bg-[#f4f5ef] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--accent-soft)]">
                {business.serviceCategoryLabel}
              </span>
            ) : null}
            <p className="line-clamp-2 text-[12px] leading-[1.35] text-[#68746a]">
              {summary}
            </p>
          </div>
        </div>
      </Link>

      <div className="px-3 pb-3">
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="rounded-full border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-[#6e7b70]">
            {actionLabel}
          </span>

          <Link
            href={business.routeState.href}
            onClick={handleCtaClick}
            className="inline-flex min-h-[32px] items-center justify-center rounded-full border border-[rgba(212,175,55,0.32)] bg-[#e5bc4f] px-3 text-[12px] font-semibold text-[#29332c] no-underline"
          >
            {actionLabel}
          </Link>
        </div>
      </div>
    </article>
  );
}
