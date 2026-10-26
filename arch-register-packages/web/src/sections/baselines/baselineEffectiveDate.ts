const pad = (value: number) => String(value).padStart(2, '0');

/** Local calendar date as yyyy-mm-dd, the format `DateInput` works with. */
export const toLocalDate = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/**
 * Turns the date picked in the dialog into the timestamp a baseline is captured as of. Today means
 * "right now"; any other day means the end of that local day, so the baseline includes everything
 * that happened on it.
 */
export const toEffectiveAt = (localDate: string, now: Date = new Date()): string | null => {
  const [year, month, day] = localDate.split('-').map(Number);
  if (!year || !month || !day) return null;
  if (localDate === toLocalDate(now)) return now.toISOString();
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
};
