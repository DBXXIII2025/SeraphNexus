import { normalizeBusinessPlan, type PlanTier } from "@/lib/planConfig";

type PlanLikeRecord = {
  plan?: unknown;
};

export type BusinessWithNormalizedPlan<T extends PlanLikeRecord> = Omit<
  T,
  "plan"
> & {
  plan: PlanTier;
};

export function normalizeBusinessPlanRecord<T extends PlanLikeRecord>(
  record: T
): BusinessWithNormalizedPlan<T> {
  return {
    ...record,
    plan: normalizeBusinessPlan(record.plan),
  };
}

export function normalizeBusinessPlanRecords<T extends PlanLikeRecord>(
  records: T[]
): Array<BusinessWithNormalizedPlan<T>> {
  return records.map(normalizeBusinessPlanRecord);
}
