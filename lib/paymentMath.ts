export function centsToDollars(value: number | string | null | undefined) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed / 100 : 0;
}

export function dollars(value: number | string | null | undefined) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function resolveBookingGrossAmount(args: {
  amount_total?: number | string | null;
  total_amount?: number | string | null;
  amount?: number | string | null;
}) {
  if (Number(args.amount_total || 0) > 0) {
    return centsToDollars(args.amount_total);
  }

  if (Number(args.total_amount || 0) > 0) {
    const totalAmount = Number(args.total_amount || 0);
    return totalAmount > 1000 ? centsToDollars(totalAmount) : dollars(totalAmount);
  }

  return dollars(args.amount);
}

export function resolveBookingPlatformFee(value: number | string | null | undefined) {
  return dollars(value);
}

export function resolveOrderGrossAmount(value: number | string | null | undefined) {
  return dollars(value);
}

export function resolveOrderPlatformFee(value: number | string | null | undefined) {
  return dollars(value);
}

export function resolveRentalGrossAmount(value: number | string | null | undefined) {
  return centsToDollars(value);
}

export function resolveRentalPlatformFee(value: number | string | null | undefined) {
  return centsToDollars(value);
}
