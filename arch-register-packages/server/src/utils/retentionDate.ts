export type RetentionTimeUnit = 'days' | 'months' | 'years';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const parseIsoDate = (value: unknown): Date | null => {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
    ? null
    : parsed;
};

export const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * Adds `duration` `timeUnit`s to `start`, using calendar (not fixed-length) arithmetic for months
 * and years so e.g. 2024-01-31 + 1 month lands on the last day of February rather than overflowing
 * into March, and 2024-02-29 + 1 year lands on 2025-02-28.
 */
export const addRetentionDuration = (
  start: Date,
  duration: number,
  timeUnit: RetentionTimeUnit
): Date => {
  if (timeUnit === 'days') {
    return new Date(start.getTime() + duration * 86_400_000);
  }

  const monthsToAdd = timeUnit === 'years' ? duration * 12 : duration;
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth();
  const day = start.getUTCDate();

  const targetMonthIndex = month + monthsToAdd;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();

  return new Date(Date.UTC(targetYear, targetMonth, Math.min(day, daysInTargetMonth)));
};
