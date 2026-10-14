import { useMemo } from 'react';
import { CalendarGrid } from '../../../components/CalendarGrid';
import { hasWidgetRecordSource, useWidgetRecords } from '../../../hooks/useEntityQueryText';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntityDrawer } from '../../entities/entityDrawer/useEntityDrawer';
import {
  buildDateCalendar,
  daysFromToday,
  parseCalendarDate,
  calendarPeriodSchema
} from './dateCalendarLogic';
import { formatMeasured, measuredValue } from './fieldAggregation';
import { countdownTone } from './upcomingByDateLogic';
import { useRecordSublabels } from './useRecordSublabels';
import rowStyles from './WidgetRowList.module.css';
import styles from './DateCalendarWidget.module.css';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import configFormStyles from '../WidgetConfigDialog.module.css';
import { z } from 'zod';
import { entityQuerySchema } from '@arch-register/api-types/entityQueryIR';
import { withInitial } from '../../markdown/mdx-components/configSchema';

const DEFAULT_PERIOD_COUNT = 12;

export const dateCalendarWidgetConfigSchema = z
  .object({
    /** Entity-query DSL text selecting the records to place on the calendar. */
    query: withInitial(z.string().optional(), ''),
    /** Structured alternative to `query`; may reference dashboard sidebar `$variables`. */
    entityQuery: entityQuerySchema.optional(),
    /** Root schema name `entityQuery`'s field names resolve against. */
    schemaName: z.string().optional(),
    /** Date field that decides which month/week a record lands in. */
    dateFieldId: withInitial(z.string().trim().min(1), ''),
    period: calendarPeriodSchema.optional(),
    periodCount: z.number().optional(),
    /** Optional field shown under the name; a reference/containment field shows the target's name. */
    sublabelFieldId: z.string().optional(),
    /** Optional number/currency field shown on each entry and summed in each cell header. */
    valueFieldId: z.string().optional(),
    /** Entry border turns red when overdue (or within this many days) and orange within `warnWithinDays`. */
    critWithinDays: z.number().optional(),
    warnWithinDays: z.number().optional()
  })
  .refine(hasWidgetRecordSource, { message: 'Needs a query or an entity query' });

export type DateCalendarWidgetConfig = z.infer<typeof dateCalendarWidgetConfigSchema>;

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
  const { data, isLoading } = useWidgetRecords(workspaceSlug, config);
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

type DateCalendarConfigFormProps = {
  config: DateCalendarWidgetConfig;
  onChange: (config: DateCalendarWidgetConfig) => void;
};

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

const optionalNumber = (value: string): number | undefined =>
  value.trim() === '' || Number.isNaN(Number(value)) ? undefined : Number(value);

export const DateCalendarConfigForm = ({ config, onChange }: DateCalendarConfigFormProps) => (
  <>
    <DialogSection label="Records (query)" required={config.entityQuery === undefined}>
      <input
        type="text"
        className={configFormStyles.labelInput}
        value={config.query ?? ''}
        placeholder='e.g. schema:"Contract"'
        onChange={e => onChange({ ...config, query: e.target.value })}
      />
    </DialogSection>
    <DialogSection label="Date field id" required>
      <input
        type="text"
        className={configFormStyles.labelInput}
        value={config.dateFieldId}
        placeholder="e.g. contract_end"
        onChange={e => onChange({ ...config, dateFieldId: e.target.value })}
      />
    </DialogSection>
    <DialogSection label="Display" required={false}>
      <div className={configFormStyles.options}>
        <label className={configFormStyles.optionRow}>
          <span className={configFormStyles.optionLabel}>Period</span>
          <div className={configFormStyles.optionControl}>
            <select
              value={config.period ?? 'month'}
              onChange={e =>
                onChange({ ...config, period: e.target.value === 'week' ? 'week' : 'month' })
              }
            >
              <option value="month">Month</option>
              <option value="week">Week</option>
            </select>
          </div>
        </label>
        <label className={configFormStyles.optionRow}>
          <span className={configFormStyles.optionLabel}>Number of periods</span>
          <div className={configFormStyles.optionControl}>
            <input
              type="number"
              min={1}
              max={36}
              className={configFormStyles.labelInput}
              value={config.periodCount ?? 12}
              onChange={e =>
                onChange({
                  ...config,
                  periodCount: Math.max(1, optionalNumber(e.target.value) ?? 12)
                })
              }
            />
          </div>
        </label>
        <label className={configFormStyles.optionRow}>
          <span className={configFormStyles.optionLabel}>Subtitle field id</span>
          <div className={configFormStyles.optionControl}>
            <input
              type="text"
              className={configFormStyles.labelInput}
              value={config.sublabelFieldId ?? ''}
              onChange={e => onChange({ ...config, sublabelFieldId: optionalText(e.target.value) })}
            />
          </div>
        </label>
        <label className={configFormStyles.optionRow}>
          <span className={configFormStyles.optionLabel}>Value field id</span>
          <div className={configFormStyles.optionControl}>
            <input
              type="text"
              className={configFormStyles.labelInput}
              value={config.valueFieldId ?? ''}
              onChange={e => onChange({ ...config, valueFieldId: optionalText(e.target.value) })}
            />
          </div>
        </label>
        <label className={configFormStyles.optionRow}>
          <span className={configFormStyles.optionLabel}>Warn within (days)</span>
          <div className={configFormStyles.optionControl}>
            <input
              type="number"
              min={0}
              className={configFormStyles.labelInput}
              value={config.warnWithinDays ?? ''}
              placeholder="30"
              onChange={e =>
                onChange({ ...config, warnWithinDays: optionalNumber(e.target.value) })
              }
            />
          </div>
        </label>
      </div>
    </DialogSection>
  </>
);
