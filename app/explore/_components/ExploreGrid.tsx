"use client";

import type { BusinessViewModel } from "../exploreData";
import ExploreBusinessCard from "./ExploreBusinessCard";

export default function ExploreGrid({
  businesses,
}: {
  businesses: BusinessViewModel[];
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {businesses.map((business) => (
        <ExploreBusinessCard key={business.id} business={business} />
      ))}
    </div>
  );
}
