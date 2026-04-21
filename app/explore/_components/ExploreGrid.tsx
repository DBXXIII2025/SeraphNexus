"use client";

import { BusinessViewModel } from "../exploreData";
import ExploreCard from "./ExploreCard";
import { PublicEmptyState } from "@/components/public/PublicLayoutSystem";

export default function ExploreGrid({
  businesses,
}: {
  businesses: BusinessViewModel[];
}) {
  if (businesses.length === 0) {
    return (
      <PublicEmptyState>
        <p>No published businesses match these filters.</p>
      </PublicEmptyState>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {businesses.map((business) => (
        <ExploreCard key={business.id} business={business} />
      ))}
    </div>
  );
}
