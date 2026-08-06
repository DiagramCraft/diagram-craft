export const formatCurrencyValue = (value: unknown): string => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return String(value);
  const currencyValue = value as { amount?: unknown; currency?: unknown };
  if (typeof currencyValue.amount !== 'number' || typeof currencyValue.currency !== 'string') {
    return String(value);
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyValue.currency
    }).format(currencyValue.amount);
  } catch {
    return `${currencyValue.amount} ${currencyValue.currency}`;
  }
};
