"use client";

import Link from "next/link";
import StructuredIcon from "@/components/icons/StructuredIcon";
import { BusinessViewModel, formatBusinessType, getCategoryMeta } from "../exploreData";

function getSummary(business: BusinessViewModel) {
  if (business.displayDescription?.trim()) {
    const normalized = business.displayDescription.trim();
    return normalized.length > 88 ? `${normalized.slice(0, 85).trimEnd()}...` : normalized;
  }

  return business.routeSummary;
}

export default function ExploreDirectoryRow({
  business,
}: {
  business: BusinessViewModel;
}) {
  const category = getCategoryMeta(business.categoryId);
  const summary = getSummary(business);

  return (
    <Link href={business.routeState.href} className="group block text-inherit no-underline">
      <article className="flex min-h-[84px] w-full items-center gap-3 rounded-[0.95rem] border border-[rgba(52,56,74,0.64)] bg-[var(--surface)] px-3 py-2 shadow-[0_6px_18px_rgba(6,8,18,0.14)] transition duration-200 group-hover:-translate-y-0.5 group-hover:border-[rgba(59,63,85,0.9)] group-hover:shadow-[0_10px_24px_rgba(6,8,18,0.18)] sm:min-h-[88px] sm:px-3.5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[0.8rem] border border-[rgba(52,56,74,0.62)] bg-[var(--surface-raised)] sm:h-16 sm:w-16">
          {business.thumbnailUrl ? (
            <img
              src={business.thumbnailUrl}
              alt={`${business.displayName} logo`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(180deg,rgba(209,213,219,0.12),rgba(38,42,61,0.92))] text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent-soft)]">
              {business.initials}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="truncate text-[0.9rem] font-semibold leading-5 text-[var(--text-strong)]">
              {business.displayName}
            </h3>
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--accent-border)] bg-[var(--accent-muted)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--accent-soft)]">
              <StructuredIcon name={business.iconName} className="h-3 w-3" />
              <span>{category.shortLabel}</span>
            </span>
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
            <span>{formatBusinessType(business.business_type)}</span>
            <span className="text-[rgba(127,132,150,0.72)]">•</span>
            <span className="truncate">{business.locationLabel}</span>
          </div>

          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[var(--text-soft)] sm:line-clamp-1">
            {summary}
          </p>
        </div>

        <div className="hidden shrink-0 items-center sm:flex">
          <span className="rounded-full border border-[rgba(52,56,74,0.62)] bg-[var(--surface-raised)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-strong)]">
            {business.routeLabel}
          </span>
        </div>

        <div className="flex shrink-0 items-center sm:hidden">
          <StructuredIcon name={business.iconName} className="h-4 w-4 text-[var(--accent-soft)]" />
        </div>
      </article>
    </Link>
  );
}
