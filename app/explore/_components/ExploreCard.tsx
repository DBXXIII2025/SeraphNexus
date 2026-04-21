"use client";

import Link from "next/link";
import { PublicCard } from "@/components/public/PublicLayoutSystem";
import { BusinessViewModel, formatBusinessType, getCategoryMeta } from "../exploreData";
import StructuredIcon from "@/components/icons/StructuredIcon";

export default function ExploreCard({
  business,
}: {
  business: BusinessViewModel;
}) {
  const category = getCategoryMeta(business.categoryId);

  return (
    <PublicCard className="min-h-[240px]">
      <div className="public-card-header">
        <div className="public-card-mark">
          {business.initials}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">
            {business.displayName}
          </h3>
          <p className="flex items-center gap-2">
            <StructuredIcon name={business.iconName} className="h-4 w-4 text-[var(--accent-soft)]" />
            {formatBusinessType(business.business_type)}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col pt-3">
        <span className="public-chip">
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
              className="public-action-primary w-full"
            >
              {business.routeLabel}
            </Link>
          ) : (
            <span className="public-action-secondary w-full">
              Unavailable
            </span>
          )}
        </div>
      </div>
    </PublicCard>
  );
}
