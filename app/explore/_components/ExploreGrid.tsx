"use client";

import type { BusinessViewModel } from "../exploreData";
import ExploreBusinessCard from "./ExploreBusinessCard";

export default function ExploreGrid({
  businesses,
}: {
  businesses: BusinessViewModel[];
}) {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {businesses.map((business) => (
        <ExploreBusinessCard key={business.id} business={business} />
      ))}
    </div>
  );
}
