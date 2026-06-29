"use client";

import Image from "next/image";
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
        <div className="flex h-full min-h-[218px] w-full flex-col overflow-hidden rounded-[1rem] border border-[rgba(52,56,74,0.72)] bg-[var(--surface)] shadow-[0_10px_22px_rgba(6,8,18,0.18)] transition duration-200 group-hover:-translate-y-0.5 group-hover:border-[rgba(59,63,85,0.95)] group-hover:shadow-[0_14px_26px_rgba(6,8,18,0.24)]">
          <div className="relative aspect-[16/9] overflow-hidden border-b border-[rgba(52,56,74,0.68)] bg-[var(--surface-raised)]">
            {business.thumbnailUrl ? (
              <Image
                src={business.thumbnailUrl}
                alt={`${business.displayName} thumbnail`}
                fill
                sizes="(min-width: 768px) 33vw, 100vw"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(180deg,rgba(209,213,219,0.12),rgba(38,42,61,0.92))]">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--accent-border)] bg-[var(--accent-muted)] text-sm font-semibold uppercase tracking-[0.1em] text-[var(--accent-soft)]">
                  {business.initials}
                </div>
              </div>
            )}
            <div className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full border border-[var(--accent-border)] bg-[rgba(24,26,42,0.78)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-soft)]">
              <StructuredIcon name={business.iconName} className="h-3 w-3" />
              <span>{category.shortLabel}</span>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-1.5 px-3 py-2.5">
            <div className="min-w-0">
              <h3 className="truncate text-[0.875rem] font-semibold leading-5 text-[var(--text-strong)]">
                {business.displayName}
              </h3>
              <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                {formatBusinessType(business.business_type)}
              </p>
            </div>

            <div className="mt-auto flex items-center justify-between gap-2 text-[11px] text-[var(--text-soft)]">
              <p className="truncate leading-4">{business.locationLabel}</p>
              <span className="shrink-0 rounded-full border border-[rgba(52,56,74,0.68)] bg-[var(--surface-raised)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--text-strong)]">
                {business.routeLabel}
              </span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
