import { useMemo } from 'react';
import { CalendarGrid } from '../../../components/CalendarGrid';
import { useWidgetRecords } from '../../../hooks/useEntityQueryText';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { caseKindLabel } from '../../../utils/governanceCaseLabels';
import { useNeedsAttentionQueue } from '../../data-views/needs-attention/needsAttentionQueue';
import { useEntityDrawer } from '../../../sections/entities/entityDrawer/useEntityDrawer';
import { buildDateCalendar, daysFromToday, parseCalendarDate } from './dateCalendarLogic';
import { formatMeasured, measuredValue } from '../../shared/data/fieldAggregation';
import { countdownTone } from '../../data-views/upcoming-by-date/upcomingByDateLogic';
import { useRecordSublabels } from '../../shared/data/useRecordSublabels';
import rowStyles from '../../shared/dashboard/WidgetRowList.module.css';
import styles from './DateCalendar.module.css';
import { DateCalendarWidgetConfig } from './types';

const DEFAULT_PERIOD_COUNT = 12;

/** Synthetic date field on the records built from cases. */
const CASE_DATE_FIELD = '_caseDueAt';
const CASE_SUBLABEL_FIELD = '_caseLabel';

const TONE_COLOR = {
  normal: undefined,
  warn: 'var(--cmp-fg-warning, #eab308)',
  crit: 'var(--cmp-fg-danger, #ef4444)'
} as const;

type Props = { config: DateCalendarWidgetConfig };

/** Records laid out on a month/week calendar by a date field - e.g. renewals, expiries, reviews. */
export const DateCalendarWidget = ({ config }: Props) => {
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const { openEntityDrawer } = useEntityDrawer();
  const recordResult = useWidgetRecords(workspaceSlug, config);
  const caseQueue = useNeedsAttentionQueue(
    workspaceSlug,
    {
      schemaId: schemas.find(schema => schema.name === config.cases?.schemaName)?.id ?? null,
      caseKinds: config.cases?.caseKinds ?? [],
      scope: config.cases?.scope ?? 'workspace'
    },
    config.cases !== undefined
  );
  const caseRecords = useMemo(
    () =>
      caseQueue.items.map(item => ({
        ...item.entity,
        _uid: item.case.id,
        [CASE_DATE_FIELD]: item.case.dueAt,
        [CASE_SUBLABEL_FIELD]: caseKindLabel(item.case.caseKind, item.case.payload)
      })) as Array<Record<string, unknown>>,
    [caseQueue.items]
  );
  const isLoading = config.cases ? caseQueue.isLoading : recordResult.isLoading;
  const data = config.cases ? { ok: true as const, entities: caseRecords } : recordResult.data;
  const dateFieldId = config.cases ? CASE_DATE_FIELD : config.dateFieldId;
  const sublabelFieldId = config.cases ? CASE_SUBLABEL_FIELD : config.sublabelFieldId;
  const today = useMemo(() => new Date(), []);
  const period = config.period ?? 'month';
  const monthly = period === 'month';

  const records = useMemo(() => data?.entities ?? [], [data]);
  const { cells, beyondCount, undatedCount } = useMemo(
    () =>
      buildDateCalendar(records, {
        dateFieldId,
        period,
        periodCount: config.periodCount ?? DEFAULT_PERIOD_COUNT,
        valueFieldId: config.valueFieldId,
        today
      }),
    [records, config, dateFieldId, period, today]
  );
  const sublabelOf = useRecordSublabels(records, sublabelFieldId);

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
                  const date = parseCalendarDate(record[dateFieldId]);
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
