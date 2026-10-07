import { firstScalarValue } from '../../../lib/scalarFieldValues';

export type MeasuredValue = { amount: number; currency?: string };

/** Reads a plain number or a `{ amount, currency }` currency value; anything else is `undefined`. */
export const measuredValue = (raw: unknown): MeasuredValue | undefined => {
  const value = firstScalarValue(raw);
  if (typeof value === 'number' && Number.isFinite(value)) return { amount: value };
  if (value !== null && typeof value === 'object') {
    const { amount, currency } = value as { amount?: unknown; currency?: unknown };
    if (typeof amount === 'number' && Number.isFinite(amount)) {
      return { amount, currency: typeof currency === 'string' ? currency : undefined };
    }
  }
  return undefined;
};

export const formatMeasured = (amount: number, currency: string | undefined): string => {
  if (currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0
      }).format(amount);
    } catch {
      return `${Math.round(amount)} ${currency}`;
    }
  }
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(amount);
};

/** Sums a numeric/currency field. The currency is kept only when every contributing value shares it. */
export const sumMeasured = (
  records: Array<Record<string, unknown>>,
  fieldId: string
): { amount: number; currency?: string } => {
  let amount = 0;
  let currency: string | undefined;
  let first = true;
  for (const record of records) {
    const value = measuredValue(record[fieldId]);
    if (!value) continue;
    amount += value.amount;
    if (first) {
      currency = value.currency;
      first = false;
    } else if (currency !== value.currency) {
      currency = undefined;
    }
  }
  return { amount, currency };
};
