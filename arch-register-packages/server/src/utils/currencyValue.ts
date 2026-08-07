import { currencyValueSchema, type CurrencyValue } from '@arch-register/api-types/common';

export const parseCurrencyValue = (value: unknown): CurrencyValue | null => {
  if (typeof value === 'string') {
    const match = value.trim().match(/^(-?(?:\d+\.?\d*|\.\d+))\s+([A-Za-z]{3})$/);
    if (!match) return null;
    return { amount: Number(match[1]), currency: match[2]!.toUpperCase() };
  }
  const parsed = currencyValueSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};
