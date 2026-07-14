import type { JobScheduleRecurrence } from './jobsDatabase';

const MINUTES_PER_DAY = 24 * 60;
const DAY_MS = 24 * 60 * 60 * 1000;

const parseTimeUtc = (value: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid UTC time '${value}', expected HH:mm`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new Error(`Invalid UTC time '${value}'`);
  return hours * 60 + minutes;
};

export const validateJobScheduleRecurrence = (recurrence: JobScheduleRecurrence) => {
  switch (recurrence.type) {
    case 'hours':
      if (!Number.isInteger(recurrence.intervalHours) || recurrence.intervalHours < 1) {
        throw new Error('Hourly recurrence intervalHours must be a positive integer');
      }
      if (Number.isNaN(recurrence.startsAt.getTime()))
        throw new Error('Invalid recurrence startsAt');
      return;
    case 'daily':
      parseTimeUtc(recurrence.timeUtc);
      return;
    case 'weekly':
      if (
        !Number.isInteger(recurrence.weekdayUtc) ||
        recurrence.weekdayUtc < 0 ||
        recurrence.weekdayUtc > 6
      ) {
        throw new Error('Weekly recurrence weekdayUtc must be between 0 and 6');
      }
      parseTimeUtc(recurrence.timeUtc);
      return;
  }
};

const atUtcTime = (date: Date, minutes: number) => {
  const result = new Date(date);
  result.setUTCHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return result;
};

export const nextJobOccurrence = (recurrence: JobScheduleRecurrence, atOrAfter: Date): Date => {
  validateJobScheduleRecurrence(recurrence);

  switch (recurrence.type) {
    case 'hours': {
      const intervalMs = recurrence.intervalHours * 60 * 60 * 1000;
      const elapsed = atOrAfter.getTime() - recurrence.startsAt.getTime();
      const steps = Math.max(0, Math.ceil(elapsed / intervalMs));
      return new Date(recurrence.startsAt.getTime() + steps * intervalMs);
    }
    case 'daily': {
      const minutes = parseTimeUtc(recurrence.timeUtc);
      let candidate = atUtcTime(atOrAfter, minutes);
      if (candidate < atOrAfter) candidate = new Date(candidate.getTime() + DAY_MS);
      return candidate;
    }
    case 'weekly': {
      const minutes = parseTimeUtc(recurrence.timeUtc);
      const dayOffset = (recurrence.weekdayUtc - atOrAfter.getUTCDay() + 7) % 7;
      let candidate = atUtcTime(new Date(atOrAfter.getTime() + dayOffset * DAY_MS), minutes);
      if (candidate < atOrAfter) candidate = new Date(candidate.getTime() + 7 * DAY_MS);
      return candidate;
    }
  }
};

export type DueJobOccurrences = {
  first: Date;
  last: Date;
  count: number;
  next: Date;
};

export const dueJobOccurrences = (
  recurrence: JobScheduleRecurrence,
  nextOccurrenceAt: Date,
  now: Date
): DueJobOccurrences | null => {
  if (nextOccurrenceAt > now) return null;

  let last = nextOccurrenceAt;
  let count = 1;
  let next = nextJobOccurrence(recurrence, new Date(last.getTime() + 1));
  while (next <= now) {
    last = next;
    count += 1;
    next = nextJobOccurrence(recurrence, new Date(last.getTime() + 1));
  }

  return { first: nextOccurrenceAt, last, count, next };
};

export const jobRecurrenceConstants = { MINUTES_PER_DAY } as const;
