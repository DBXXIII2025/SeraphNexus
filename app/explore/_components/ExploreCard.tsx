"use client";

import Link from "next/link";
import { BusinessViewModel, formatBusinessType, getCategoryMeta } from "../exploreData";
import StructuredIcon from "@/components/icons/StructuredIcon";

export default function ExploreCard({
  business,
}: {
  business: BusinessViewModel;
}) {
  const category = getCategoryMeta(business.categoryId);

  return (
    <Link href={business.routeState.href} className="group block h-full text-inherit no-underline">
      <article className="h-full">
        <div className="flex h-full min-h-[252px] w-full flex-col overflow-hidden rounded-[1.1rem] border border-[var(--border-soft)] bg-[var(--surface)] shadow-[0_14px_34px_rgba(6,8,18,0.24)] transition duration-200 group-hover:-translate-y-1 group-hover:border-[var(--accent-border)] group-hover:shadow-[0_22px_44px_rgba(6,8,18,0.34)]">
          <div className="relative aspect-[4/3] overflow-hidden border-b border-[var(--border-soft)] bg-[var(--surface-raised)]">
            {business.thumbnailUrl ? (
              <img
                src={business.thumbnailUrl}
                alt={`${business.displayName} thumbnail`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(180deg,rgba(209,213,219,0.12),rgba(38,42,61,0.92))]">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[var(--accent-border)] bg-[var(--accent-muted)] text-lg font-semibold uppercase tracking-[0.14em] text-[var(--accent-soft)]">
                  {business.initials}
                </div>
              </div>
            )}
            <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-border)] bg-[rgba(24,26,42,0.82)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-soft)]">
              <StructuredIcon name={business.iconName} className="h-3.5 w-3.5" />
              <span>{category.shortLabel}</span>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-2 px-3.5 py-3">
            <div className="min-w-0">
              <h3 className="truncate text-[0.95rem] font-semibold text-[var(--text-strong)]">
                {business.displayName}
              </h3>
              <p className="mt-1 truncate text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                {formatBusinessType(business.business_type)}
              </p>
            </div>

            <div className="mt-auto flex items-center justify-between gap-3 text-xs text-[var(--text-soft)]">
              <p className="truncate">{business.locationLabel}</p>
              <span className="shrink-0 rounded-full border border-[var(--border-soft)] bg-[var(--surface-raised)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-strong)]">
                {business.routeLabel}
              </span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
