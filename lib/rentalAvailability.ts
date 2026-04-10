type DateRangeRecord = {
  id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  check_in_date?: string | null;
  check_out_date?: string | null;
  date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  status?: string | null;
  payment_status?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  phone?: string | null;
  guest_name?: string | null;
  guest_email?: string | null;
  guest_phone?: string | null;
};

type DateRange = {
  startDate: string;
  endDateExclusive: string;
};

export type RentalAvailabilityConflict<T extends DateRangeRecord> = {
  row: T;
  range: DateRange;
};

export type RentalAvailabilityTimestampConflict<T extends DateRangeRecord> = {
  row: T;
  range: {
    startBoundary: string;
    endBoundary: string;
  };
};

export type RentalAvailabilityEvaluation<TBooking extends DateRangeRecord, TBlock extends DateRangeRecord> = {
  available: boolean;
  reason:
    | "available"
    | "invalid-range"
    | "past-start-date"
    | "blocked-dates"
    | "existing-booking";
  bookingConflicts: Array<RentalAvailabilityConflict<TBooking>>;
  blockConflicts: Array<RentalAvailabilityConflict<TBlock>>;
};

export function normalizeDate(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

export function normalizeTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

export function addDays(date: string, days: number) {
  const normalized = normalizeDate(date);
  if (!normalized) {
    return null;
  }

  const cursor = new Date(`${normalized}T00:00:00.000Z`);
  cursor.setUTCDate(cursor.getUTCDate() + days);
  return cursor.toISOString().slice(0, 10);
}

export function getTodayDate(timeZone?: string) {
  if (timeZone) {
    try {
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const parts = formatter.formatToParts(new Date());
      const year = parts.find((part) => part.type === "year")?.value;
      const month = parts.find((part) => part.type === "month")?.value;
      const day = parts.find((part) => part.type === "day")?.value;

      if (year && month && day) {
        return `${year}-${month}-${day}`;
      }
    } catch {
      // Fall back to UTC string when the provided timezone is invalid.
    }
  }

  return new Date().toISOString().slice(0, 10);
}

function getFormatterParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  const second = Number(parts.find((part) => part.type === "second")?.value);

  return { year, month, day, hour, minute, second };
}

export function zonedDateTimeToUtcIso(
  date: string,
  time: string,
  timeZone = "UTC"
) {
  const normalizedDate = normalizeDate(date);
  if (!normalizedDate) {
    return null;
  }

  const [year, month, day] = normalizedDate.split("-").map(Number);
  const [hour, minute, second = 0] = time.split(":").map(Number);

  const guessUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0));
  const zoned = getFormatterParts(guessUtc, timeZone);
  const zonedAsUtc = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute,
    zoned.second,
    0
  );
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  const offset = zonedAsUtc - guessUtc.getTime();

  return new Date(targetAsUtc - offset).toISOString();
}

export function getRequestedStayBoundaries(
  startDate: string,
  endDateExclusive: string,
  timeZone?: string
) {
  const startBoundary =
    zonedDateTimeToUtcIso(startDate, "00:00:00", timeZone || "UTC") ||
    `${startDate}T00:00:00.000Z`;
  const endExclusiveBoundary =
    zonedDateTimeToUtcIso(endDateExclusive, "00:00:00", timeZone || "UTC") ||
    `${endDateExclusive}T00:00:00.000Z`;
  const endBoundaryDate = new Date(endExclusiveBoundary);
  endBoundaryDate.setMilliseconds(endBoundaryDate.getMilliseconds() - 1);

  return {
    startBoundary,
    endBoundary: endBoundaryDate.toISOString(),
  };
}

export function listDatesBetween(startDate: string, endDateExclusive: string) {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDateExclusive}T00:00:00.000Z`);

  while (cursor < end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

export function overlapsDateRange(
  startA: string,
  endAExclusive: string,
  startB: string,
  endBExclusive: string
) {
  return startA < endBExclusive && endAExclusive > startB;
}

export function overlapsTimestampRange(
  startA: string,
  endA: string,
  startB: string,
  endB: string
) {
  return new Date(startA).getTime() <= new Date(endB).getTime() &&
    new Date(endA).getTime() >= new Date(startB).getTime();
}

export function overlapsBlockedDateRange(
  blockStartDate: string,
  blockEndDate: string,
  requestedCheckInDate: string,
  requestedCheckOutDate: string
) {
  return (
    blockStartDate <= requestedCheckOutDate &&
    blockEndDate >= requestedCheckInDate
  );
}

export function overlapsReservationDateRange(
  reservationCheckInDate: string,
  reservationCheckOutDate: string,
  requestedCheckInDate: string,
  requestedCheckOutDate: string
) {
  return (
    reservationCheckInDate < requestedCheckOutDate &&
    reservationCheckOutDate > requestedCheckInDate
  );
}

export function getRecordDateRange(record: DateRangeRecord) {
  const checkInDate = normalizeDate(record.check_in_date || null);
  const checkOutDate = normalizeDate(record.check_out_date || null);

  if (checkInDate) {
    const exclusiveEnd =
      checkOutDate && checkOutDate > checkInDate ? checkOutDate : addDays(checkInDate, 1);

    if (!exclusiveEnd) {
      return null;
    }

    return {
      startDate: checkInDate,
      endDateExclusive: exclusiveEnd,
    };
  }

  const start = normalizeDate(record.start_date || record.date || null);
  const rawEnd = normalizeDate(record.end_date || null);

  if (start) {
    const exclusiveEnd = record.start_date
      ? addDays(rawEnd || start, 1)
      : rawEnd && rawEnd > start
        ? rawEnd
        : addDays(start, 1);

    if (!exclusiveEnd) {
      return null;
    }

    return {
      startDate: start,
      endDateExclusive: exclusiveEnd,
    };
  }

  const timestampRange = getRecordTimestampRange(record);
  if (!timestampRange) {
    return null;
  }

  const derivedStart = timestampRange.startBoundary.slice(0, 10);
  const derivedEndInclusive = timestampRange.endBoundary.slice(0, 10);
  const exclusiveEnd = addDays(derivedEndInclusive, 1);

  if (!exclusiveEnd) {
    return null;
  }

  return {
    startDate: derivedStart,
    endDateExclusive: exclusiveEnd,
  };
}

export function getRecordTimestampRange(record: DateRangeRecord) {
  const startBoundary = normalizeTimestamp(record.start_time || null);
  const endBoundary = normalizeTimestamp(record.end_time || null);

  if (!startBoundary || !endBoundary) {
    return null;
  }

  return {
    startBoundary,
    endBoundary,
  };
}

export function isActiveRentalBooking(record: DateRangeRecord) {
  const status = String(record.status || "").toLowerCase();
  const paymentStatus = String(record.payment_status || "").toLowerCase();

  if (status === "cancelled" || status === "completed") {
    return false;
  }

  if (
    status === "confirmed" ||
    status === "paid" ||
    paymentStatus === "paid"
  ) {
    return true;
  }

  return false;
}

export function buildUnavailableDates(records: DateRangeRecord[]) {
  const unavailable = new Set<string>();

  for (const row of records) {
    const range = getRecordDateRange(row);
    if (!range) {
      continue;
    }

    for (const date of listDatesBetween(range.startDate, range.endDateExclusive)) {
      unavailable.add(date);
    }
  }

  return Array.from(unavailable).sort();
}

export function buildUnavailableDatesFromTimestampRecords(
  records: DateRangeRecord[],
  timeZone = "UTC"
) {
  const unavailable = new Set<string>();

  for (const row of records) {
    const range = getRecordTimestampRange(row);
    if (!range) {
      continue;
    }

    const start = new Date(range.startBoundary);
    const end = new Date(range.endBoundary);
    const cursor = new Date(start);

    while (cursor <= end) {
      unavailable.add(getTodayDateForMoment(cursor, timeZone));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return Array.from(unavailable).sort();
}

function getTodayDateForMoment(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

export function findDateRangeConflicts<T extends DateRangeRecord>(
  startDate: string,
  endDateExclusive: string,
  records: T[]
) {
  return records.reduce<Array<RentalAvailabilityConflict<T>>>((conflicts, row) => {
    const range = getRecordDateRange(row);

    if (!range) {
      return conflicts;
    }

    if (
      overlapsDateRange(
        startDate,
        endDateExclusive,
        range.startDate,
        range.endDateExclusive
      )
    ) {
      conflicts.push({
        row,
        range,
      });
    }

    return conflicts;
  }, []);
}

export function findTimestampRangeConflicts<T extends DateRangeRecord>(
  startBoundary: string,
  endBoundary: string,
  records: T[]
) {
  return records.reduce<Array<RentalAvailabilityTimestampConflict<T>>>((conflicts, row) => {
    const range = getRecordTimestampRange(row);

    if (!range) {
      return conflicts;
    }

    if (
      overlapsTimestampRange(
        range.startBoundary,
        range.endBoundary,
        startBoundary,
        endBoundary
      )
    ) {
      conflicts.push({
        row,
        range,
      });
    }

    return conflicts;
  }, []);
}

export function getBookingDisplayRange(record: DateRangeRecord) {
  const checkInDate = normalizeDate(record.check_in_date || null);
  const checkOutDate = normalizeDate(record.check_out_date || null);

  if (checkInDate) {
    return {
      startDate: checkInDate,
      endDate: checkOutDate || checkInDate,
    };
  }

  const storedStart = normalizeDate(record.date || null);
  const storedEnd = normalizeDate(record.end_date || null);

  if (storedStart) {
    return {
      startDate: storedStart,
      endDate: storedEnd || storedStart,
    };
  }

  const timestampRange = getRecordTimestampRange(record);
  if (!timestampRange) {
    return null;
  }

  return {
    startDate: timestampRange.startBoundary.slice(0, 10),
    endDate: timestampRange.endBoundary.slice(0, 10),
  };
}

export function evaluateRentalAvailability<
  TBooking extends DateRangeRecord,
  TBlock extends DateRangeRecord,
>({
  startDate,
  endDateExclusive,
  bookings,
  blocks,
  todayDate = getTodayDate(),
}: {
  startDate: string | null | undefined;
  endDateExclusive: string | null | undefined;
  bookings: TBooking[];
  blocks: TBlock[];
  todayDate?: string;
}): RentalAvailabilityEvaluation<TBooking, TBlock> {
  const normalizedStart = normalizeDate(startDate);
  const normalizedEnd = normalizeDate(endDateExclusive);

  if (!normalizedStart || !normalizedEnd || normalizedEnd <= normalizedStart) {
    return {
      available: false,
      reason: "invalid-range",
      bookingConflicts: [],
      blockConflicts: [],
    };
  }

  if (normalizedStart < todayDate) {
    return {
      available: false,
      reason: "past-start-date",
      bookingConflicts: [],
      blockConflicts: [],
    };
  }

  const bookingConflicts = findDateRangeConflicts(normalizedStart, normalizedEnd, bookings);
  const blockConflicts = findDateRangeConflicts(normalizedStart, normalizedEnd, blocks);

  if (blockConflicts.length > 0) {
    return {
      available: false,
      reason: "blocked-dates",
      bookingConflicts,
      blockConflicts,
    };
  }

  if (bookingConflicts.length > 0) {
    return {
      available: false,
      reason: "existing-booking",
      bookingConflicts,
      blockConflicts,
    };
  }

  return {
    available: true,
    reason: "available",
    bookingConflicts,
    blockConflicts,
  };
}

export function formatReservationRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined
) {
  if (!startDate) {
    return "Date pending";
  }

  if (!endDate || endDate === startDate) {
    return startDate;
  }

  return `${startDate} to ${endDate}`;
}

export function getReservationGuestLabel(record: DateRangeRecord) {
  return (
    record.guest_name ||
    record.customer_name ||
    record.guest_email ||
    record.customer_email ||
    "Guest"
  );
}
