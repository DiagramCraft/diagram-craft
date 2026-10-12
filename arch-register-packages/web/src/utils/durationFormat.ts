import type { DurationUnit } from '@arch-register/api-types/common';

const UNIT_LABELS: Record<DurationUnit, [singular: string, plural: string]> = {
  days: ['day', 'days'],
  weeks: ['week', 'weeks'],
  months: ['month', 'months'],
  years: ['year', 'years']
};

// Keep in sync with DAYS_PER_UNIT in server/src/utils/durationValue.ts
const DAYS_PER_UNIT: Record<DurationUnit, number> = {
  days: 1,
  weeks: 7,
  months: 30.4375,
  years: 365.25
};

/** Converts a stored `{ amount, unit }` duration to days; null if the value is not a duration. */
export const durationToDays = (value: unknown): number | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { amount, unit } = value as { amount?: unknown; unit?: unknown };
  if (typeof amount !== 'number' || typeof unit !== 'string' || !(unit in DAYS_PER_UNIT)) {
    return null;
  }
  return amount * DAYS_PER_UNIT[unit as DurationUnit];
};

export const durationUnitLabel = (unit: DurationUnit): string => {
  const [, plural] = UNIT_LABELS[unit];
  return plural.charAt(0).toUpperCase() + plural.slice(1);
};

/** Formats a stored `{ amount, unit }` duration as e.g. "3 years"; falls back to the raw value. */
export const formatDurationValue = (value: unknown): string => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return String(value);
  const { amount, unit } = value as { amount?: unknown; unit?: unknown };
  if (typeof amount !== 'number' || typeof unit !== 'string' || !(unit in UNIT_LABELS)) {
    return String(value);
  }
  const [singular, plural] = UNIT_LABELS[unit as DurationUnit];
  return `${amount} ${amount === 1 ? singular : plural}`;
};

/** Encodes a partially filled duration as an editable "<amount> <unit>" string; '' if no amount. */
export const encodeDurationText = (value: { amount?: number; unit?: DurationUnit }): string =>
  value.amount === undefined ? '' : `${value.amount} ${value.unit ?? 'years'}`;

/** Parses the "<amount> <unit>" string produced by encodeDurationText; null if incomplete. */
export const decodeDurationText = (text: string): { amount: number; unit: DurationUnit } | null => {
  const [amount, unit] = text.trim().split(/\s+/, 2);
  if (amount === undefined || amount === '' || unit === undefined || !(unit in UNIT_LABELS)) {
    return null;
  }
  const parsed = Number(amount);
  return Number.isFinite(parsed) && parsed >= 0 ? { amount: parsed, unit: unit as DurationUnit } : null;
};
