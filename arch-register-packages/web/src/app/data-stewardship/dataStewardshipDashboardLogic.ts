import type { DataStewardshipQueueItem } from './dataStewardshipQueue';
import { DS_QUEUE_CASE_KINDS } from './dataStewardshipQueue';

/**
 * Pure logic behind the My work dashboard widgets (`dataStewardshipDashboardWidgets.tsx`), kept
 * separate so it can be unit tested without rendering.
 */

export type CaseWidgetScope = 'mine' | 'workspace' | 'late';
export type CaseCountTone = 'none' | 'warning' | 'danger';

export const CASE_WIDGET_SCOPES: readonly CaseWidgetScope[] = ['mine', 'workspace', 'late'];
export const CASE_COUNT_TONES: readonly CaseCountTone[] = ['none', 'warning', 'danger'];

/** An empty `caseKinds` list means "every kind the Data Stewardship queue draws on". */
export const effectiveCaseKinds = (caseKinds: readonly string[]): readonly string[] =>
  caseKinds.length === 0 ? DS_QUEUE_CASE_KINDS : caseKinds;

export const filterByCaseKinds = (
  items: readonly DataStewardshipQueueItem[],
  caseKinds: readonly string[]
): DataStewardshipQueueItem[] =>
  caseKinds.length === 0
    ? [...items]
    : items.filter(item => caseKinds.includes(item.case.caseKind));

/**
 * Items due within `days` days from `now`, *including* already-overdue items (there is no lower
 * bound) — matching the original My work screen's "N due within a week" subtext.
 */
export const countDueWithin = (
  items: readonly DataStewardshipQueueItem[],
  days: number,
  now: Date = new Date()
): number =>
  items.filter(item => {
    if (!item.case.dueAt) return false;
    return (new Date(item.case.dueAt).getTime() - now.getTime()) / 86400000 <= days;
  }).length;

/** Oldest deadline first; items without a due date sort first (as the original screen did). */
export const sortByDueDate = (
  items: readonly DataStewardshipQueueItem[]
): DataStewardshipQueueItem[] =>
  [...items].sort((a, b) => (a.case.dueAt ?? '').localeCompare(b.case.dueAt ?? ''));

/** Replaces `{count}` and `{due}` in a subtext template. */
export const renderSubtext = (template: string, count: number, due: number): string =>
  template.replaceAll('{count}', String(count)).replaceAll('{due}', String(due));

export const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(entry => typeof entry === 'string');
