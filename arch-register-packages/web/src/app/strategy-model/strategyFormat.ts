import type { NumberFormat } from '@arch-register/api-types/app/strategy-model/strategyModelViewConfig';

const compactMoney = (amount: number): string =>
  amount >= 1_000_000
    ? `$${(amount / 1_000_000).toFixed(1)}m`
    : amount >= 1_000
      ? `$${Math.round(amount / 1_000)}k`
      : `$${Math.round(amount)}`;

/**
 * Render a roll-up / overlay numeric value per its configured {@link NumberFormat}. `currency`
 * (when known) is used for the `currency` format's symbol; otherwise a compact `$` fallback.
 */
export const formatStrategyValue = (
  value: number | null | undefined,
  format: NumberFormat,
  currency?: string | null
): string => {
  if (value == null) return '—';
  switch (format) {
    case 'number':
      return String(Math.round(value));
    case 'decimal1':
      return value.toFixed(1);
    case 'percent':
      return `${Math.round(value * (Math.abs(value) <= 1 ? 100 : 1))}%`;
    case 'currency':
      if (currency) {
        try {
          return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
            notation: 'compact'
          }).format(value);
        } catch {
          return compactMoney(value);
        }
      }
      return compactMoney(value);
  }
};
