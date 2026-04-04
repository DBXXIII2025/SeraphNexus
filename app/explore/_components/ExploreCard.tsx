"use client";

import Link from "next/link";
import { BusinessViewModel, formatBusinessType, getCategoryMeta } from "../exploreData";

export default function ExploreCard({
  business,
}: {
  business: BusinessViewModel;
}) {
  const category = getCategoryMeta(business.categoryId);

  return (
    <article className="flex h-full min-h-[246px] flex-col overflow-hidden rounded-[1.25rem] border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(28,22,22,0.98),rgba(17,14,14,0.98))] shadow-[0_18px_40px_rgba(0,0,0,0.22)] transition duration-200 hover:-translate-y-1 hover:border-[rgba(212,175,55,0.18)] hover:shadow-[0_22px_46px_rgba(0,0,0,0.26)]">
      <div className="flex items-center gap-3 border-b border-[rgba(255,255,255,0.05)] px-4 py-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[rgba(212,175,55,0.14)] bg-[linear-gradient(135deg,rgba(212,175,55,0.18),rgba(193,18,31,0.1))] text-sm font-semibold uppercase tracking-[0.14em] text-[var(--accent-gold-soft)]">
          {business.initials}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-[var(--text-strong)]">
            {business.displayName}
          </h3>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            {formatBusinessType(business.business_type)}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 py-4">
        <span className="inline-flex w-fit rounded-full border border-[rgba(212,175,55,0.12)] bg-[rgba(212,175,55,0.07)] px-2.5 py-1 text-[10px] font-medium tracking-[0.06em] text-[var(--accent-gold-soft)]">
          {category.shortLabel}
        </span>

        <p className="mt-3 min-h-[3rem] line-clamp-2 text-sm leading-6 text-[var(--text-soft)]">
          {business.displayDescription}
        </p>

        <div className="mt-auto pt-5">
          {business.routeState.isRoutable ? (
            <Link
              href={business.routeState.href}
              className="btn-primary inline-flex min-h-10 w-full items-center justify-center px-4 py-2 text-sm font-semibold"
            >
              {business.routeLabel}
            </Link>
          ) : (
            <span className="btn-secondary inline-flex min-h-10 w-full items-center justify-center px-4 py-2 text-sm font-medium text-[var(--text-soft)]">
              Unavailable
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
