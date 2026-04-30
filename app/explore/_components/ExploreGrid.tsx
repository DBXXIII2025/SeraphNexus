"use client";

import type { BusinessViewModel } from "../exploreData";
import ExploreBusinessCard from "./ExploreBusinessCard";

export default function ExploreGrid({
  businesses,
}: {
  businesses: BusinessViewModel[];
}) {
  return (
    <div className="explore-market-grid">
      {businesses.map((business) => (
        <ExploreBusinessCard key={business.id} business={business} />
      ))}
    </div>
  );
}
