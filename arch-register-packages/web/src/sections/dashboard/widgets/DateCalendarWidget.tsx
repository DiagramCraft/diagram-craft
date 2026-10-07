import { useMemo } from 'react';
import { CalendarGrid } from '../../../components/CalendarGrid';
import {
  hasWidgetRecordSource,
  useWidgetRecords,
  type WidgetRecordSource
} from '../../../hooks/useEntityQueryText';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntityDrawer } from '../../entities/entityDrawer/useEntityDrawer';
import {
  buildDateCalendar,
  daysFromToday,
  parseCalendarDate,
  type CalendarPeriod
} from './dateCalendarLogic';
import { formatMeasured, measuredValue } from './fieldAggregation';
import { countdownTone } from './upcomingByDateLogic';
import { useRecordSublabels } from './useRecordSublabels';
import rowStyles from './WidgetRowList.module.css';
import styles from './DateCalendarWidget.module.css';

const DEFAULT_PERIOD_COUNT = 12;

export type DateCalendarWidgetConfig = {
  /** Entity-query DSL text selecting the records to place on the calendar. */
  query?: string;
  /** Structured alternative to `query`; may reference dashboard sidebar `$variables`. */
  entityQuery?: EntityQuery;
  /** Root schema name `entityQuery`'s field names resolve against. */
  schemaName?: string;
  /** Date field that decides which month/week a record lands in. */
  dateFieldId: string;
  period?: CalendarPeriod;
  periodCount?: number;
  /** Optional field shown under the name; a reference/containment field shows the target's name. */
  sublabelFieldId?: string;
  /** Optional number/currency field shown on each entry and summed in each cell header. */
  valueFieldId?: string;
  /** Entry border turns red when overdue (or within this many days) and orange within `warnWithinDays`. */
  critWithinDays?: number;
  warnWithinDays?: number;
  label?: string;
};

export const isDateCalendarConfigComplete = (config: DateCalendarWidgetConfig): boolean =>
  hasWidgetRecordSource(config as WidgetRecordSource) && config.dateFieldId.trim() !== '';

const TONE_COLOR = {
  normal: undefined,
  warn: 'var(--cmp-fg-warning, #eab308)',
  crit: 'var(--cmp-fg-danger, #ef4444)'
} as const;

type Props = { config: DateCalendarWidgetConfig };

/** Records laid out on a month/week calendar by a date field - e.g. renewals, expiries, reviews. */
export const DateCalendarWidget = ({ config }: Props) => {
  const { workspaceSlug } = useWorkspaceContext();
  const { openEntityDrawer } = useEntityDrawer();
  const complete = isDateCalendarConfigComplete(config);
  const { data, isLoading } = useWidgetRecords(workspaceSlug, complete ? config : {});
  const today = useMemo(() => new Date(), []);
  const period = config.period ?? 'month';
  const monthly = period === 'month';

  const records = useMemo(() => data?.entities ?? [], [data]);
  const { cells, beyondCount, undatedCount } = useMemo(
    () =>
      buildDateCalendar(records, {
        dateFieldId: config.dateFieldId,
        period,
        periodCount: config.periodCount ?? DEFAULT_PERIOD_COUNT,
        valueFieldId: config.valueFieldId,
        today
      }),
    [records, config, period, today]
  );
  const sublabelOf = useRecordSublabels(records, config.sublabelFieldId);

  if (!complete) {
    return (
      <div className={`${rowStyles.emptyInline} dim`}>This widget is not fully configured.</div>
    );
  }
  if (isLoading) return <div className={`${rowStyles.emptyInline} dim`}>Loading…</div>;
  if (data?.ok === false) {
    return <div className={`${rowStyles.emptyInline} dim`}>This widget's query is not valid.</div>;
  }

  return (
    <div>
      <CalendarGrid
        columns={monthly ? 4 : 6}
        collapseColumns={monthly ? 2 : 3}
        collapseBreakpoint={monthly ? 1100 : 1420}
        cellClassName={styles.cell}
        cells={cells.map(cell => ({
          key: cell.key,
          emphasized: !monthly && cell.current,
          label: <span className={styles.cellLabel}>{cell.label}</span>,
          headerRight: (
            <span className={`${styles.cellLabel} dim mono tabular`}>
              {cell.total
                ? cell.records.length === 0
                  ? '—'
                  : formatMeasured(cell.total.amount, cell.total.currency)
                : cell.records.length}
            </span>
          ),
          children:
            cell.records.length === 0 ? (
              <div className={`${styles.empty} dim`}>Nothing due</div>
            ) : (
              <div className={styles.entries}>
                {cell.records.map(record => {
                  const date = parseCalendarDate(record[config.dateFieldId]);
                  const days = date ? daysFromToday(date, today) : 0;
                  const tone = date
                    ? countdownTone(days, config.warnWithinDays ?? 30, config.critWithinDays ?? -1)
                    : 'normal';
                  const sublabel = sublabelOf(record);
                  const value = config.valueFieldId
                    ? measuredValue(record[config.valueFieldId])
                    : undefined;
                  return (
                    <button
                      key={String(record._uid)}
                      type="button"
                      className={styles.entry}
                      style={{ '--tone': TONE_COLOR[tone] } as React.CSSProperties}
                      onClick={() => openEntityDrawer(String(record._publicId))}
                    >
                      <span className="dim mono tabular">{date ? date.getDate() : '—'}</span>
                      <span className={styles.entryMain}>
                        <span className={styles.entryName}>{sublabel ?? String(record._name)}</span>
                        {sublabel && (
                          <span className={`${styles.entrySub} dim`}>{String(record._name)}</span>
                        )}
                      </span>
                      {value && (
                        <span className="dim mono tabular">
                          {formatMeasured(value.amount, value.currency)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )
        }))}
      />
      {(beyondCount > 0 || undatedCount > 0) && (
        <div className={`${styles.caption} dim`}>
          {beyondCount > 0 && <span>{beyondCount} fall beyond this calendar. </span>}
          {undatedCount > 0 && <span>{undatedCount} have no date. </span>}
        </div>
      )}
    </div>
  );
};
