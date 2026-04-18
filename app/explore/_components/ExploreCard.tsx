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
    <article className="flex h-full min-h-[220px] flex-col overflow-hidden border p-3">
      <div className="flex items-center gap-3 border-b pb-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center border">
          {business.initials}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">
            {business.displayName}
          </h3>
          <p>
            {formatBusinessType(business.business_type)}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col pt-3">
        <span className="inline-flex w-fit border px-2 py-1">
          {category.shortLabel}
        </span>

        {business.displayDescription ? (
          <p className="mt-3 min-h-[3rem] line-clamp-2">
            {business.displayDescription}
          </p>
        ) : (
          <p className="mt-3 min-h-[3rem]">No public description yet.</p>
        )}

        <div className="mt-auto pt-4">
          {business.routeState.isRoutable ? (
            <Link
              href={business.routeState.href}
              className="inline-flex min-h-10 w-full items-center justify-center border px-4 py-2"
            >
              {business.routeLabel}
            </Link>
          ) : (
            <span className="inline-flex min-h-10 w-full items-center justify-center border px-4 py-2">
              Unavailable
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
