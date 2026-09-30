import { useMemo } from 'react';
import type { DataStewardshipQueueItem } from '../dataStewardshipQueue';
import { queueItemPriority } from '../dataStewardshipQueue';
import { caseKindLabel } from '../../../utils/governanceCaseLabels';
import { bucketByPeriod } from '../../../utils/calendarBuckets';
import { CalendarGrid } from '../../../components/CalendarGrid';
import styles from './DataStewardshipReviewCalendar.module.css';

const WEEK_LABEL = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

const PRIORITY_TONE = {
  high: 'var(--cmp-fg-danger, #ef4444)',
  medium: 'var(--cmp-fg-warning, #eab308)',
  low: 'var(--cmp-fg-dim, #9ca3af)'
} as const;

const startOfWeek = (date: Date): Date => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = start.getDay();
  // ISO-style week start (Monday); Sunday (0) rolls back 6 days instead of forward.
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  return start;
};

const weekKey = (date: Date): string => date.toISOString().slice(0, 10);

type WeekBucket = {
  key: string;
  label: string;
  isNow: boolean;
  items: DataStewardshipQueueItem[];
};

/**
 * Builds the six-week grid (current week + next 5), one bucket per week, bucketing queue items by
 * `case.dueAt`. An item already overdue is folded into the current week's bucket instead of being
 * dropped off the front of the grid — the same "don't silently lose visibility of overdue items"
 * precedent `../../vendor-management/sections/VendorContractsCalendar.tsx` establishes for its own
 * (monthly) renewal calendar, and a deliberate small deviation from the Claude Design reference's
 * `dsCalendar` (`ds-data.jsx`), which starts the grid at the current week and has no such fold —
 * the "Past due" scope tab/stat already covers that case here.
 */
export const buildReviewCalendarWeeks = (
  items: readonly DataStewardshipQueueItem[],
  today: Date
): WeekBucket[] => {
  const { buckets } = bucketByPeriod({
    items,
    today,
    periodCount: 6,
    getItemDate: item => (item.case.dueAt ? new Date(item.case.dueAt) : null),
    startOfPeriod: startOfWeek,
    periodStartAt: (currentPeriodStart, index) => {
      const start = new Date(currentPeriodStart);
      start.setDate(start.getDate() + index * 7);
      return start;
    },
    periodKey: weekKey,
    periodLabel: (periodStart, index) =>
      index === 0 ? 'This week' : `w/c ${WEEK_LABEL.format(periodStart)}`
  });

  return buckets.map(({ key, label, items: bucketItems }, index) => ({
    key,
    label,
    isNow: index === 0,
    items: bucketItems
  }));
};

/**
 * A six-week grid (current week + next 5), one cell per week, bucketing queue items by
 * `case.dueAt`. No existing weekly-bucketed calendar component exists elsewhere in the repo (only
 * `VendorContractsCalendar`'s monthly one) — this is new, purpose-built for the six-week review
 * window the design calls for rather than a generic calendar.
 */
export const DataStewardshipReviewCalendar = ({
  items,
  onOpenItem
}: {
  items: readonly DataStewardshipQueueItem[];
  onOpenItem: (item: DataStewardshipQueueItem) => void;
}) => {
  const today = useMemo(() => new Date(), []);

  const weeks = useMemo(() => buildReviewCalendarWeeks(items, today), [items, today]);

  return (
    <div className={styles.wrapper}>
      <CalendarGrid
        columns={6}
        collapseColumns={3}
        collapseBreakpoint={1420}
        cellClassName={styles.cell}
        cells={weeks.map(week => ({
          key: week.key,
          emphasized: week.isNow,
          label: <span className={styles.cellLabel}>{week.label}</span>,
          headerRight: <span className={`${styles.cellCount} mono`}>{week.items.length}</span>,
          children:
            week.items.length === 0 ? (
              <div className={styles.empty}>No reviews due</div>
            ) : (
              <div className={styles.entries}>
                {week.items.map(item => (
                  <button
                    key={item.case.id}
                    type="button"
                    className={styles.entry}
                    style={
                      {
                        '--tone': PRIORITY_TONE[queueItemPriority(item.case, today)]
                      } as React.CSSProperties
                    }
                    title={item.dataset._name}
                    onClick={() => onOpenItem(item)}
                  >
                    {caseKindLabel(item.case.caseKind, item.case.payload)} — {item.dataset._name}
                  </button>
                ))}
              </div>
            )
        }))}
      />
    </div>
  );
};
