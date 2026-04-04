"use client";

import { BusinessViewModel } from "../exploreData";
import ExploreCard from "./ExploreCard";

export default function ExploreGrid({
  businesses,
}: {
  businesses: BusinessViewModel[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {businesses.map((business) => (
        <ExploreCard key={business.id} business={business} />
      ))}
    </div>
  );
}
