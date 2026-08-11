import type { Milestone } from '@arch-register/api-types/milestoneContract';
import type { Project } from '@arch-register/api-types/projectContract';
import type { TimelineViewData } from '@arch-register/api-types/entityContract';
import { dateToTimelinePx, parseTimelineDate } from '../../../components/timeline/timelineUtils';
import type { TimelineHorizonBand, TimelineHorizonId } from './timelineViewTypes';

const HORIZON_LABELS: Record<TimelineHorizonId, string> = {
  historical: 'Historical',
  now: 'Now',
  next: 'Next',
  later: 'Later'
};

const getQuarterStart = (date: Date): Date =>
  new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);

const addMonths = (date: Date, months: number): Date =>
  new Date(date.getFullYear(), date.getMonth() + months, 1);

export const buildTimelineHorizonBands = ({
  today,
  rangeStart,
  rangeEnd,
  totalWidth
}: {
  today: Date;
  rangeStart: Date;
  rangeEnd: Date;
  totalWidth: number;
}): TimelineHorizonBand[] => {
  const nowStart = getQuarterStart(today);
  const nextStart = addMonths(nowStart, 3);
  const laterStart = addMonths(nowStart, 6);
  const definitions: Array<{ id: TimelineHorizonId; start: Date; end: Date }> = [
    { id: 'historical', start: rangeStart, end: nowStart },
    { id: 'now', start: nowStart, end: nextStart },
    { id: 'next', start: nextStart, end: laterStart },
    { id: 'later', start: laterStart, end: rangeEnd }
  ];

  return definitions.flatMap(({ id, start, end }) => {
    const clippedStart = new Date(Math.max(start.getTime(), rangeStart.getTime()));
    const clippedEnd = new Date(Math.min(end.getTime(), rangeEnd.getTime()));
    if (clippedEnd <= clippedStart) return [];

    const left = dateToTimelinePx(clippedStart, rangeStart, rangeEnd, totalWidth);
    const right = dateToTimelinePx(clippedEnd, rangeStart, rangeEnd, totalWidth);
    if (right <= left) return [];

    return [
      {
        id,
        label: HORIZON_LABELS[id],
        start: clippedStart,
        end: clippedEnd,
        left,
        width: right - left
      }
    ];
  });
};

const addDate = (dates: Date[], value: unknown) => {
  const date = value instanceof Date ? value : parseTimelineDate(value);
  if (date) dates.push(date);
};

export const collectTimelineEventDates = (
  timelineData: Record<string, TimelineViewData>,
  milestones: Iterable<Milestone>,
  projects: Project[]
): Date[] => {
  const dates: Date[] = [];
  for (const data of Object.values(timelineData)) {
    for (const version of data.versions) addDate(dates, version.created_at);
    for (const entry of data.projectChanges) {
      addDate(dates, entry.changeCase.target_date ?? entry.changeCase.created_at);
    }
  }
  for (const milestone of milestones) addDate(dates, milestone.target_date);
  for (const project of projects) {
    addDate(dates, project.start_date);
    addDate(dates, project.target_date);
  }
  return dates;
};
