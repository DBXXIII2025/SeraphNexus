export function generateSlots({
  start,
  end,
  durationMinutes,
}: {
  start: string;
  end: string;
  durationMinutes: number;
}) {
  const slots = [];

  const startDate = new Date(`1970-01-01T${start}`);
  const endDate = new Date(`1970-01-01T${end}`);

  let current = new Date(startDate);

  while (current < endDate) {
    const next = new Date(current.getTime() + durationMinutes * 60000);

    if (next <= endDate) {
      slots.push({
        start: current.toTimeString().slice(0, 5),
        end: next.toTimeString().slice(0, 5),
      });
    }

    current = next;
  }

  return slots;
}