import type { StructuredIconName } from "@/components/icons/StructuredIcon";
import { getExploreBusinessIconName } from "@/lib/exploreBusinessTypes";

export function getBusinessTypeIconName(
  businessType: string | null | undefined
): StructuredIconName {
  return getExploreBusinessIconName(businessType);
}
