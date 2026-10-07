import type { DurationUnit } from '@arch-register/api-types/common';

const UNIT_LABELS: Record<DurationUnit, [singular: string, plural: string]> = {
  days: ['day', 'days'],
  weeks: ['week', 'weeks'],
  months: ['month', 'months'],
  years: ['year', 'years']
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
