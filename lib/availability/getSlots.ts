export function generateSlots({
  start,
  end,
  durationMinutes,
  intervalMinutes = 30,
}: {
  start: string;
  end: string;
  durationMinutes: number;
  intervalMinutes?: number;
}) {
  const slots = [];

  const startDate = new Date(`1970-01-01T${start}`);
  const endDate = new Date(`1970-01-01T${end}`);

  let current = new Date(startDate);

  const safeIntervalMinutes =
    Number.isFinite(intervalMinutes) && intervalMinutes > 0
      ? intervalMinutes
      : 30;

  while (current < endDate) {
    const next = new Date(current.getTime() + durationMinutes * 60000);

    if (next <= endDate) {
      slots.push({
        start: current.toTimeString().slice(0, 5),
        end: next.toTimeString().slice(0, 5),
      });
    }

    current = new Date(current.getTime() + safeIntervalMinutes * 60000);
  }

  return slots;
}
