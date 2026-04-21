"use client";

import { BusinessViewModel, getCategoryMeta, type ExploreCategoryId } from "../exploreData";
import ExploreDirectoryRow from "./ExploreDirectoryRow";
import { PublicEmptyState } from "@/components/public/PublicLayoutSystem";

export default function ExploreGrid({
  businesses,
  activeCategory,
}: {
  businesses: BusinessViewModel[];
  activeCategory: ExploreCategoryId;
}) {
  if (businesses.length === 0) {
    const category = getCategoryMeta(activeCategory);

    return (
      <PublicEmptyState>
        <p>No published {category.label.toLowerCase()} businesses match this view.</p>
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
