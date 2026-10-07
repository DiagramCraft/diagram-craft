import { daysBetween } from './dateBucketLogic';

export type UpcomingRow<T> = { record: T; date: string; days: number };

/** Records with a date inside `[today - includeOverdue, today + windowDays]`, soonest first. */
export const buildUpcomingRows = <T extends Record<string, unknown>>(
  records: T[],
  options: {
    dateFieldId: string;
    windowDays?: number;
    includeOverdue?: boolean;
    limit: number;
    today?: Date;
  }
): UpcomingRow<T>[] => {
  const today = options.today ?? new Date();
  return records
    .flatMap(record => {
      const raw = record[options.dateFieldId];
      const date = Array.isArray(raw) ? raw[0] : raw;
      if (typeof date !== 'string' || date.length < 10) return [];
      const days = daysBetween(date, today);
      if (days < 0 && !options.includeOverdue) return [];
      if (options.windowDays !== undefined && days > options.windowDays) return [];
      return [{ record, date, days }];
    })
    .sort((a, b) => a.days - b.days)
    .slice(0, options.limit);
};

export const formatCountdown = (days: number): string =>
  days < 0 ? `${-days}d ago` : days === 0 ? 'today' : `${days}d`;

export type CountdownTone = 'normal' | 'warn' | 'crit';

export const countdownTone = (days: number, warnWithin = 90, critWithin = 30): CountdownTone =>
  days <= critWithin ? 'crit' : days <= warnWithin ? 'warn' : 'normal';
