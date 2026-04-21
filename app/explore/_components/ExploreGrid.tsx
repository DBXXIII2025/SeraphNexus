"use client";

import { BusinessViewModel } from "../exploreData";
import ExploreDirectoryRow from "./ExploreDirectoryRow";
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
    <div className="space-y-2">
      {businesses.map((business) => (
        <ExploreDirectoryRow key={business.id} business={business} />
      ))}
    </div>
  );
}
