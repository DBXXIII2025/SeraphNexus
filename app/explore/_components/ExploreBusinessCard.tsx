"use client";

import Link from "next/link";
import { formatBusinessType, type BusinessViewModel } from "../exploreData";

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

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[1rem] border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(22,25,30,0.98),rgba(17,19,23,0.98))] shadow-[0_14px_28px_rgba(0,0,0,0.28)] transition duration-200 hover:-translate-y-0.5 hover:border-[rgba(212,175,55,0.18)] hover:shadow-[0_18px_34px_rgba(0,0,0,0.34)]">
      <div className="relative aspect-[16/10] overflow-hidden border-b border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)]">
        {business.thumbnailUrl ? (
          <img
            src={business.thumbnailUrl}
            alt={`${business.displayName} logo`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(180deg,rgba(212,175,55,0.08),rgba(255,255,255,0.02))]">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(212,175,55,0.18)] bg-[rgba(255,255,255,0.03)] text-base font-semibold uppercase tracking-[0.08em] text-[var(--accent-soft)]">
              {business.initials}
            </span>
          </div>
        )}

        <div className="absolute left-3 top-3 inline-flex items-center rounded-full border border-[rgba(212,175,55,0.18)] bg-[rgba(11,12,14,0.78)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-soft)]">
          {formatBusinessType(business.business_type)}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-2">
          <h3 className="line-clamp-1 text-[1rem] font-semibold text-[var(--text-strong)]">
            {business.displayName}
          </h3>
          <p className="line-clamp-3 text-sm leading-6 text-[var(--text-soft)]">{summary}</p>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3">
          <span className="rounded-full border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--text-muted)]">
            {actionLabel}
          </span>

          <Link
            href={business.routeState.href}
            className="inline-flex min-h-[38px] items-center justify-center rounded-full border border-[rgba(212,175,55,0.32)] bg-[linear-gradient(180deg,#e6c76a,#d4af37)] px-4 text-sm font-semibold text-[var(--accent-contrast)] no-underline"
          >
            {actionLabel}
          </Link>
        </div>
      </div>
    </article>
  );
}
