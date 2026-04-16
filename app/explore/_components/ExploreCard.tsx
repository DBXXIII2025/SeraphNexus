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
    <article className="flex h-full min-h-[246px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)] transition duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_22px_46px_rgba(15,23,42,0.12)]">
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-sm font-semibold uppercase tracking-[0.14em] text-slate-800">
          {business.initials}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-slate-950">
            {business.displayName}
          </h3>
          <p className="mt-1 text-[11px] text-slate-500">
            {formatBusinessType(business.business_type)}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 py-4">
        <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium tracking-[0.06em] text-slate-700">
          {category.shortLabel}
        </span>

        <p className="mt-3 min-h-[3rem] line-clamp-2 text-sm leading-6 text-slate-600">
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
