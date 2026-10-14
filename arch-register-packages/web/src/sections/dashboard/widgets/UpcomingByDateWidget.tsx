import { useMemo } from 'react';
import { useQueryTextEntities } from '../../../hooks/useEntityQueryText';
import { useEntitiesByIds } from '../../../hooks/useEntities';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { scalarValues } from '../../../lib/scalarFieldValues';
import { useEntityDrawer } from '../../entities/entityDrawer/useEntityDrawer';
import { formatMeasured, measuredValue } from './fieldAggregation';
import { buildUpcomingRows, countdownTone, formatCountdown } from './upcomingByDateLogic';
import rowStyles from './WidgetRowList.module.css';
import styles from './UpcomingByDateWidget.module.css';
import { TbCalendarTime } from 'react-icons/tb';
import type { DashboardWidgetRegistrationSpec } from '../../markdown/mdx-components/types';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import configFormStyles from '../WidgetConfigDialog.module.css';

const DEFAULT_LIMIT = 7;

export type UpcomingByDateWidgetConfig = {
  /** Entity-query DSL text selecting the records to list. */
  query: string;
  /** Date field the list is ordered by. */
  dateFieldId: string;
  /** Only show records due within this many days. */
  windowDays?: number;
  /** Also show records whose date has passed. */
  includeOverdue?: boolean;
  limit?: number;
  /** Optional field shown under the name; a reference/containment field shows the target's name. */
  sublabelFieldId?: string;
  /** Optional number/currency field shown on the right. */
  valueFieldId?: string;
  /** Countdown turns red within this many days (default 30) and orange within `warnWithinDays`. */
  critWithinDays?: number;
  warnWithinDays?: number;
};

export const isUpcomingByDateConfigComplete = (config: UpcomingByDateWidgetConfig): boolean =>
  config.query.trim() !== '' && config.dateFieldId.trim() !== '';

const TONE_COLOR = {
  normal: undefined,
  warn: 'var(--cmp-fg-warning, #eab308)',
  crit: 'var(--cmp-fg-danger, #ef4444)'
} as const;

type Props = { config: UpcomingByDateWidgetConfig };

/** Records ordered by an upcoming date, each with a countdown - e.g. renewals, expiries, reviews. */
export const UpcomingByDateWidget = ({ config }: Props) => {
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const { openEntityDrawer } = useEntityDrawer();
  const complete = isUpcomingByDateConfigComplete(config);
  const { data, isLoading } = useQueryTextEntities(workspaceSlug, config.query, complete);

  const rows = useMemo(
    () =>
      buildUpcomingRows(data?.entities ?? [], {
        dateFieldId: config.dateFieldId,
        windowDays: config.windowDays,
        includeOverdue: config.includeOverdue,
        limit: config.limit ?? DEFAULT_LIMIT
      }),
    [data, config]
  );

  const sublabelField = useMemo(() => {
    if (!config.sublabelFieldId) return undefined;
    const first = rows[0]?.record;
    const schemaId = first?._schemaId ?? (first?._schema as { id?: string } | undefined)?.id;
    return schemas
      .find(schema => schema.id === schemaId)
      ?.fields.find(field => field.id === config.sublabelFieldId);
  }, [schemas, rows, config.sublabelFieldId]);
  const sublabelIsReference =
    sublabelField?.type === 'reference' || sublabelField?.type === 'containment';

  const referencedIds = useMemo(
    () =>
      sublabelIsReference
        ? rows.flatMap(row =>
            scalarValues(row.record[config.sublabelFieldId!]).filter(
              (value): value is string => typeof value === 'string'
            )
          )
        : [],
    [rows, sublabelIsReference, config.sublabelFieldId]
  );
  const referenced = useEntitiesByIds(workspaceSlug, referencedIds);

  if (!complete) {
    return (
      <div className={`${rowStyles.emptyInline} dim`}>This widget is not fully configured.</div>
    );
  }
  if (isLoading) return <div className={`${rowStyles.emptyInline} dim`}>Loading…</div>;
  if (data?.ok === false) {
    return <div className={`${rowStyles.emptyInline} dim`}>This widget's query is not valid.</div>;
  }
  if (rows.length === 0) {
    return <div className={`${rowStyles.emptyInline} dim`}>Nothing upcoming.</div>;
  }

  const sublabelOf = (record: Record<string, unknown>): string | undefined => {
    if (!config.sublabelFieldId) return undefined;
    const values = scalarValues(record[config.sublabelFieldId]);
    const text = values
      .map(value =>
        sublabelIsReference && typeof value === 'string'
          ? referenced.get(value)?.name
          : typeof value === 'string' || typeof value === 'number'
            ? String(value)
            : undefined
      )
      .filter((value): value is string => !!value)
      .join(', ');
    return text === '' ? undefined : text;
  };

  return (
    <div className={rowStyles.list}>
      {rows.map(({ record, days }) => {
        const sublabel = sublabelOf(record);
        const value = config.valueFieldId ? measuredValue(record[config.valueFieldId]) : undefined;
        return (
          <button
            key={String(record._uid)}
            type="button"
            className={`${rowStyles.row} ${styles.row}`}
            onClick={() => openEntityDrawer(String(record._publicId))}
          >
            <span className={styles.text}>
              <span className={rowStyles.rowLabel}>{String(record._name)}</span>
              {sublabel && <span className={`${rowStyles.rowSub} dim`}>{sublabel}</span>}
            </span>
            {value && (
              <span className={`${rowStyles.rowMeta} mono`}>
                {formatMeasured(value.amount, value.currency)}
              </span>
            )}
            <span
              className={styles.countdown}
              style={{
                color: TONE_COLOR[countdownTone(days, config.warnWithinDays, config.critWithinDays)]
              }}
            >
              {formatCountdown(days)}
            </span>
          </button>
        );
      })}
    </div>
  );
};

type UpcomingByDateConfigFormProps = {
  config: UpcomingByDateWidgetConfig;
  onChange: (config: UpcomingByDateWidgetConfig) => void;
};

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

const optionalNumber = (value: string): number | undefined =>
  value.trim() === '' || Number.isNaN(Number(value)) ? undefined : Number(value);

export const UpcomingByDateConfigForm = ({ config, onChange }: UpcomingByDateConfigFormProps) => (
  <>
    <DialogSection label="Records (query)" required>
      <input
        type="text"
        className={configFormStyles.labelInput}
        value={config.query}
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
          <span className={configFormStyles.optionLabel}>Within (days)</span>
          <div className={configFormStyles.optionControl}>
            <input
              type="number"
              min={0}
              className={configFormStyles.labelInput}
              value={config.windowDays ?? ''}
              placeholder="No limit"
              onChange={e => onChange({ ...config, windowDays: optionalNumber(e.target.value) })}
            />
          </div>
        </label>
        <label className={configFormStyles.optionRow}>
          <span className={configFormStyles.optionLabel}>Show</span>
          <div className={configFormStyles.optionControl}>
            <input
              type="number"
              min={1}
              max={50}
              className={configFormStyles.labelInput}
              value={config.limit ?? 7}
              onChange={e =>
                onChange({ ...config, limit: Math.max(1, optionalNumber(e.target.value) ?? 7) })
              }
            />
          </div>
        </label>
        <label className={configFormStyles.optionRow}>
          <span className={configFormStyles.optionLabel}>Include overdue</span>
          <div className={configFormStyles.optionControl}>
            <input
              type="checkbox"
              checked={config.includeOverdue ?? false}
              onChange={e => onChange({ ...config, includeOverdue: e.target.checked || undefined })}
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
      </div>
    </DialogSection>
  </>
);

export const UPCOMING_BY_DATE_TYPE = 'UpcomingByDate' as const;

const isOptionalNumber = (value: unknown): boolean =>
  value === undefined || (typeof value === 'number' && Number.isFinite(value));

const optionalString = (value: unknown): boolean =>
  value === undefined || typeof value === 'string';

export const _upcomingByDateSpecData: Omit<
  DashboardWidgetRegistrationSpec<UpcomingByDateWidgetConfig>,
  'label' | 'description'
> = {
  icon: TbCalendarTime,
  defaultW: 6,
  defaultH: 16,
  surfaces: ['workspace'],
  component: UpcomingByDateWidget,
  isValidConfig: (config): config is UpcomingByDateWidgetConfig =>
    typeof config.query === 'string' &&
    typeof config.dateFieldId === 'string' &&
    isOptionalNumber(config.windowDays) &&
    isOptionalNumber(config.limit) &&
    isOptionalNumber(config.critWithinDays) &&
    isOptionalNumber(config.warnWithinDays) &&
    optionalString(config.sublabelFieldId) &&
    optionalString(config.valueFieldId) &&
    (config.includeOverdue === undefined || typeof config.includeOverdue === 'boolean') &&
    isUpcomingByDateConfigComplete(config as UpcomingByDateWidgetConfig),
  createDefaultProps: () => ({ config: { query: '', dateFieldId: '' } }),
  configForm: UpcomingByDateConfigForm
};
