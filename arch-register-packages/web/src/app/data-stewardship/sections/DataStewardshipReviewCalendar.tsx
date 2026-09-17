import { useMemo } from 'react';
import type { DataStewardshipQueueItem } from '../dataStewardshipQueue';
import { queueItemPriority } from '../dataStewardshipQueue';
import { caseKindLabel } from '../../../utils/governanceCaseLabels';
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
 * A six-week grid (current week + next 5), one cell per week, bucketing queue items by
 * `case.dueAt`. An item already overdue is folded into the current week's cell instead of being
 * dropped off the front of the grid — the same "don't silently lose visibility of overdue items"
 * precedent `../../vendor-management/sections/VendorContractsCalendar.tsx` establishes for its own
 * (monthly) renewal calendar, and a deliberate small deviation from the Claude Design reference's
 * `dsCalendar` (`ds-data.jsx`), which starts the grid at the current week and has no such fold —
 * the "Past due" scope tab/stat already covers that case here.
 *
 * No existing weekly-bucketed calendar component exists elsewhere in the repo (only
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

  const weeks = useMemo(() => {
    const currentWeekStart = startOfWeek(today);
    const currentKey = weekKey(currentWeekStart);
    const weekStarts: Date[] = [];
    for (let i = 0; i < 6; i++) {
      const start = new Date(currentWeekStart);
      start.setDate(start.getDate() + i * 7);
      weekStarts.push(start);
    }
    const lastKey = weekKey(weekStarts[weekStarts.length - 1]!);

    const buckets = new Map<string, WeekBucket>(
      weekStarts.map((start, index) => {
        const key = weekKey(start);
        return [
          key,
          {
            key,
            label: index === 0 ? 'This week' : `w/c ${WEEK_LABEL.format(start)}`,
            isNow: index === 0,
            items: []
          }
        ];
      })
    );

    for (const item of items) {
      if (!item.case.dueAt) continue;
      const due = new Date(item.case.dueAt);
      if (Number.isNaN(due.getTime())) continue;
      const dueWeekStart = startOfWeek(due);
      const key = dueWeekStart < currentWeekStart ? currentKey : weekKey(dueWeekStart);
      if (key > lastKey) continue;
      buckets.get(key)?.items.push(item);
    }

    return [...buckets.values()];
  }, [items, today]);

  return (
    <div className={styles.grid}>
      {weeks.map(week => (
        <div
          key={week.key}
          className={week.isNow ? `${styles.cell} ${styles.cellNow}` : styles.cell}
        >
          <div className={styles.cellHeader}>
            <span className={styles.cellLabel}>{week.label}</span>
            <span className={`${styles.cellCount} mono`}>{week.items.length}</span>
          </div>
          {week.items.length === 0 ? (
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
          )}
        </div>
      ))}
    </div>
  );
};
