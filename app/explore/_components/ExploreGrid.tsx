"use client";

import { BusinessViewModel } from "../exploreData";
import ExploreCard from "./ExploreCard";

export default function ExploreGrid({
  businesses,
}: {
  businesses: BusinessViewModel[];
}) {
  if (businesses.length === 0) {
    return (
      <div className="border p-4">
        <p>No published businesses match these filters.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {businesses.map((business) => (
        <ExploreCard key={business.id} business={business} />
      ))}
    </div>
  );
}
