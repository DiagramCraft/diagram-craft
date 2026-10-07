import {
  durationUnitSchema,
  durationValueSchema,
  type DurationUnit,
  type DurationValue
} from '@arch-register/api-types/common';

const UNIT_ALIASES: Record<string, DurationUnit> = {
  d: 'days',
  day: 'days',
  days: 'days',
  w: 'weeks',
  week: 'weeks',
  weeks: 'weeks',
  m: 'months',
  month: 'months',
  months: 'months',
  y: 'years',
  year: 'years',
  years: 'years'
};

/** Accepts `{ amount, unit }` or a string such as "3 years" / "6m". */
export const parseDurationValue = (value: unknown): DurationValue | null => {
  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d+\.?\d*|\.\d+)\s*([A-Za-z]+)$/);
    if (!match) return null;
    const unit = UNIT_ALIASES[match[2]!.toLowerCase()];
    return unit ? { amount: Number(match[1]), unit } : null;
  }
  const parsed = durationValueSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

// Approximate conversion used for range comparisons and sorting across units.
// Keep in sync with the SQL CASE in durationDaysSql.
export const DAYS_PER_UNIT: Record<DurationUnit, number> = {
  days: 1,
  weeks: 7,
  months: 30.4375,
  years: 365.25
};

export const durationToDays = (value: DurationValue): number =>
  value.amount * DAYS_PER_UNIT[value.unit];

export const isDurationUnit = (value: unknown): value is DurationUnit =>
  durationUnitSchema.safeParse(value).success;
