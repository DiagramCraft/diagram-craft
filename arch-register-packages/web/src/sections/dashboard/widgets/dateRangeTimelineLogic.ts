import { parseTimelineDate } from '../../../components/timeline/timelineUtils';

export type PositionedRange<T> = {
  record: T;
  start: Date;
  end: Date;
  /** Marker date (end minus the offset), when the record has one. */
  markerDate: Date | null;
  markerDays: number | null;
};

const subtractDays = (date: Date, days: number): Date => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - days);
  return copy;
};

const firstValue = (raw: unknown): unknown => (Array.isArray(raw) ? raw[0] : raw);

/**
 * Records with both a parseable start and end date can be drawn as a bar; the rest are excluded
 * and counted. When `markerOffsetFieldId` is set, a record gets a marker `offset` days before its
 * end - only if `markerWhenFieldId` is unset or that field is truthy (e.g. an auto-renew flag).
 */
export const buildPositionedRanges = <T extends Record<string, unknown>>(
  records: readonly T[],
  options: {
    startFieldId: string;
    endFieldId: string;
    markerOffsetFieldId?: string;
    markerWhenFieldId?: string;
  }
): { positioned: PositionedRange<T>[]; excludedCount: number } => {
  const positioned: PositionedRange<T>[] = [];
  let excludedCount = 0;
  for (const record of records) {
    const start = parseTimelineDate(firstValue(record[options.startFieldId]));
    const end = parseTimelineDate(firstValue(record[options.endFieldId]));
    if (!start || !end) {
      excludedCount++;
      continue;
    }
    const offset = options.markerOffsetFieldId
      ? firstValue(record[options.markerOffsetFieldId])
      : undefined;
    const markerApplies =
      !options.markerWhenFieldId || firstValue(record[options.markerWhenFieldId]) === true;
    const markerDays = typeof offset === 'number' && markerApplies ? offset : null;
    positioned.push({
      record,
      start,
      end,
      markerDate: markerDays === null ? null : subtractDays(end, markerDays),
      markerDays
    });
  }
  return { positioned, excludedCount };
};
