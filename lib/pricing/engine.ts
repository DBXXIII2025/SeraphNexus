export type PricingRule = {
  id?: string | null;
  business_id?: string | null;
  service_id?: string | null;
  day_of_week?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  active?: boolean | null;
  priority?: number | null;
  rule_type?: string | null;
  amount?: number | null;
  percentage?: number | null;
  metadata?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
};

type BookingLike = {
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  created_at?: string | null;
};

type SlotInput = {
  date: string;
  start: string;
  end: string;
};

export type SlotPriceCalculationResult = {
  price: number;
  basePrice: number;
  priceAdjustment: number;
  matchedRuleCount: number;
  appliedAmountAdjustment: boolean;
  appliedPercentageAdjustment: boolean;
  fallbackUsed: boolean;
};

function parseTimeToMinutes(time: string) {
  const [h, m] = time.split(":").map((v) => Number(v));
  return h * 60 + (m || 0);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isSimilarTime(a: string, b: string, toleranceMinutes = 60) {
  const diff = Math.abs(parseTimeToMinutes(a) - parseTimeToMinutes(b));
  return diff <= toleranceMinutes;
}

function daysBetween(a: Date, b: Date) {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function normalizePercentage(value: number) {
  if (!Number.isFinite(value) || value === 0) {
    return 0;
  }

  return Math.abs(value) > 1 ? Math.abs(value) / 100 : Math.abs(value);
}

function isDiscountRuleType(ruleType: string | null | undefined) {
  const normalized = (ruleType || "").trim().toLowerCase();
  return (
    normalized.includes("discount") ||
    normalized.includes("decrease") ||
    normalized.includes("subtract") ||
    normalized.includes("off") ||
    normalized.includes("markdown")
  );
}

function isTimeScopedRule(rule: PricingRule) {
  return Boolean(rule.start_time && rule.end_time);
}

function matchesSlotWindow(rule: PricingRule, slot: SlotInput) {
  if (!rule.start_time || !rule.end_time) {
    return true;
  }

  const ruleStart = parseTimeToMinutes(rule.start_time);
  const ruleEnd = parseTimeToMinutes(rule.end_time);
  const slotStart = parseTimeToMinutes(slot.start);
  const slotEnd = parseTimeToMinutes(slot.end);

  return slotStart < ruleEnd && slotEnd > ruleStart;
}

export function calculateDemandScore({
  slot,
  allBookings,
  recentBookings,
  now = new Date(),
}: {
  slot: SlotInput;
  allBookings: BookingLike[];
  recentBookings: BookingLike[];
  now?: Date;
}) {
  const similarBookings = allBookings.filter((b) => {
    if (!b.start_time || !b.date) return false;
    return isSimilarTime(b.start_time, slot.start, 60);
  });

  const similarScore = clamp(similarBookings.length * 8, 0, 40);
  const recentScore = clamp(recentBookings.length * 4, 0, 25);

  const slotDate = new Date(`${slot.date}T00:00:00`);
  const daysUntil = daysBetween(now, slotDate);
  let proximityScore = 0;

  if (daysUntil <= 0) proximityScore = 25;
  else if (daysUntil <= 1) proximityScore = 20;
  else if (daysUntil <= 3) proximityScore = 15;
  else if (daysUntil <= 7) proximityScore = 8;

  return clamp(similarScore + recentScore + proximityScore, 0, 100);
}

export function shouldApplyGapDiscount({
  slot,
  bookingsForDate,
}: {
  slot: SlotInput;
  bookingsForDate: BookingLike[];
}) {
  const slotStart = parseTimeToMinutes(slot.start);
  const slotEnd = parseTimeToMinutes(slot.end);

  const hasBefore = bookingsForDate.some((b) => {
    if (!b.end_time) return false;
    return parseTimeToMinutes(b.end_time) === slotStart;
  });

  const hasAfter = bookingsForDate.some((b) => {
    if (!b.start_time) return false;
    return parseTimeToMinutes(b.start_time) === slotEnd;
  });

  return hasBefore && hasAfter;
}

function calculateDemandAdjustedBasePrice({
  basePrice,
  demandScore,
  gapDiscount,
}: {
  basePrice: number;
  demandScore: number;
  gapDiscount: boolean;
}) {
  const safeBasePrice = Number.isFinite(basePrice) && basePrice > 0 ? basePrice : 100;

  let price = safeBasePrice;

  if (demandScore >= 70) {
    price = safeBasePrice * 1.25;
  } else if (demandScore <= 30) {
    price = safeBasePrice * (1 - 0.15);
  }

  if (gapDiscount) {
    price = price * (1 - 0.15);
  }

  return Math.max(10, Math.round(price * 100) / 100);
}

function getMatchedPricingRules({
  pricingRules,
  slot,
  serviceId,
  dayOfWeek,
}: {
  pricingRules: PricingRule[];
  slot: SlotInput;
  serviceId?: string | null;
  dayOfWeek?: number | null;
}) {
  return pricingRules
    .filter((rule) => rule.active !== false)
    .filter((rule) => !rule.service_id || !serviceId || rule.service_id === serviceId)
    .filter((rule) => {
      if (rule.service_id && !serviceId) {
        return false;
      }

      return true;
    })
    .filter((rule) => {
      if (typeof rule.day_of_week !== "number" || dayOfWeek === null || dayOfWeek === undefined) {
        return true;
      }

      return rule.day_of_week === dayOfWeek;
    })
    .filter((rule) => matchesSlotWindow(rule, slot))
    .sort((a, b) => {
      const priorityA = Number.isFinite(Number(a.priority)) ? Number(a.priority) : 0;
      const priorityB = Number.isFinite(Number(b.priority)) ? Number(b.priority) : 0;

      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }

      const scopedA = isTimeScopedRule(a) ? 1 : 0;
      const scopedB = isTimeScopedRule(b) ? 1 : 0;
      if (scopedA !== scopedB) {
        return scopedB - scopedA;
      }

      const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return createdB - createdA;
    });
}

export function calculateSlotPrice({
  slot,
  demandScore,
  gapDiscount,
  basePrice,
  pricingRules = [],
  serviceId,
  dayOfWeek,
}: {
  slot: SlotInput;
  demandScore: number;
  gapDiscount: boolean;
  basePrice: number;
  pricingRules?: PricingRule[];
  serviceId?: string | null;
  dayOfWeek?: number | null;
}): SlotPriceCalculationResult {
  const initialPrice = calculateDemandAdjustedBasePrice({
    basePrice,
    demandScore,
    gapDiscount,
  });

  const matchedRules = getMatchedPricingRules({
    pricingRules,
    slot,
    serviceId,
    dayOfWeek,
  });

  let price = initialPrice;
  let appliedAmountAdjustment = false;
  let appliedPercentageAdjustment = false;

  for (const rule of matchedRules) {
    const isDiscount = isDiscountRuleType(rule.rule_type);

    if (Number.isFinite(Number(rule.amount)) && Number(rule.amount) !== 0) {
      const amount = Math.abs(Number(rule.amount));
      price += isDiscount ? -amount : amount;
      appliedAmountAdjustment = true;
    }

    if (Number.isFinite(Number(rule.percentage)) && Number(rule.percentage) !== 0) {
      const percentage = normalizePercentage(Number(rule.percentage));
      const multiplier = isDiscount ? 1 - percentage : 1 + percentage;
      price *= Math.max(0, multiplier);
      appliedPercentageAdjustment = true;
    }
  }

  const roundedPrice = Math.max(1, Math.round(price * 100) / 100);

  return {
    price: roundedPrice,
    basePrice: initialPrice,
    priceAdjustment: Math.round((roundedPrice - initialPrice) * 100) / 100,
    matchedRuleCount: matchedRules.length,
    appliedAmountAdjustment,
    appliedPercentageAdjustment,
    fallbackUsed: matchedRules.length === 0,
  };
}
