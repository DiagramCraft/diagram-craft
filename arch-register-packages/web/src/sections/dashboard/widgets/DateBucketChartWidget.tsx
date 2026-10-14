import { useMemo } from 'react';
import { useQueryTextEntities } from '../../../hooks/useEntityQueryText';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { buildDateBuckets } from './dateBucketLogic';
import { formatMeasured } from './fieldAggregation';
import rowStyles from './WidgetRowList.module.css';
import styles from './DateBucketChartWidget.module.css';
import { TbChartBar } from 'react-icons/tb';
import type { DashboardWidgetSpec } from '../../markdown/mdx-components/types';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import configFormStyles from '../WidgetConfigDialog.module.css';

const DEFAULT_BUCKET_COUNT = 12;
const MONTH_LABEL = new Intl.DateTimeFormat(undefined, { month: 'short' });

export type DateBucketChartWidgetConfig = {
  /** Entity-query DSL text selecting the records to chart. */
  query: string;
  /** Date field whose month decides the bucket. */
  dateFieldId: string;
  /** Number/currency field summed per bucket; omit to chart record counts. */
  measureFieldId?: string;
  /** Number of months shown, starting at the current month. Default 12. */
  bucketCount?: number;
  /** Count past-dated records in the current month instead of dropping them. */
  foldOverdue?: boolean;
  /** Buckets with a record due within this many days (or overdue) are drawn in the urgent colour. */
  urgentWithinDays?: number;
};

export const isDateBucketChartConfigComplete = (config: DateBucketChartWidgetConfig): boolean =>
  config.query.trim() !== '' && config.dateFieldId.trim() !== '';

type Props = { config: DateBucketChartWidgetConfig };

const useDateBuckets = (config: DateBucketChartWidgetConfig) => {
  const { workspaceSlug } = useWorkspaceContext();
  const complete = isDateBucketChartConfigComplete(config);
  const { data, isLoading } = useQueryTextEntities(workspaceSlug, config.query, complete);
  const buckets = useMemo(
    () =>
      buildDateBuckets(data?.entities ?? [], {
        dateFieldId: config.dateFieldId,
        bucketCount: config.bucketCount ?? DEFAULT_BUCKET_COUNT,
        measureFieldId: config.measureFieldId,
        foldOverdue: config.foldOverdue,
        urgentWithinDays: config.urgentWithinDays
      }),
    [data, config]
  );
  return { complete, isLoading, valid: data?.ok !== false, buckets };
};

/** Frame-header count of the records that fall inside the charted range. */
export const DateBucketChartHeaderActions = ({ config }: Props) => {
  const { buckets, isLoading, complete, valid } = useDateBuckets(config);
  if (!complete || !valid || isLoading) return null;
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  return <span className="dim mono">{total} in range</span>;
};

/** Month-bucketed bar chart of a date field: record counts or a summed measure per month. */
export const DateBucketChartWidget = ({ config }: Props) => {
  const { complete, isLoading, valid, buckets } = useDateBuckets(config);

  if (!complete) {
    return (
      <div className={`${rowStyles.emptyInline} dim`}>This widget is not fully configured.</div>
    );
  }
  if (isLoading) return <div className={`${rowStyles.emptyInline} dim`}>Loading…</div>;
  if (!valid) {
    return <div className={`${rowStyles.emptyInline} dim`}>This widget's query is not valid.</div>;
  }

  const measured = !!config.measureFieldId;
  const barValue = (bucket: (typeof buckets)[number]) => (measured ? bucket.total : bucket.count);
  const max = Math.max(...buckets.map(barValue), 0);

  return (
    <div className={styles.root}>
      <div className={styles.bars}>
        {buckets.map(bucket => {
          const value = barValue(bucket);
          return (
            <div key={bucket.key} className={styles.column}>
              <div className={styles.track}>
                <div
                  className={bucket.urgent ? styles.barUrgent : styles.bar}
                  style={{ height: `${max > 0 ? Math.max(2, (100 * value) / max) : 2}%` }}
                />
              </div>
              <div className={`${styles.value} dim mono`}>
                {value > 0 ? (measured ? formatMeasured(value, bucket.currency) : value) : '—'}
              </div>
              <div className={`${styles.month} dim mono`}>
                {MONTH_LABEL.format(bucket.start)}
                {bucket.start.getMonth() === 0
                  ? ` ${String(bucket.start.getFullYear()).slice(2)}`
                  : ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

type DateBucketChartConfigFormProps = {
  config: DateBucketChartWidgetConfig;
  onChange: (config: DateBucketChartWidgetConfig) => void;
};

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

const optionalNumber = (value: string): number | undefined =>
  value.trim() === '' || Number.isNaN(Number(value)) ? undefined : Number(value);

export const DateBucketChartConfigForm = ({ config, onChange }: DateBucketChartConfigFormProps) => (
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
          <span className={configFormStyles.optionLabel}>Sum field id</span>
          <div className={configFormStyles.optionControl}>
            <input
              type="text"
              className={configFormStyles.labelInput}
              value={config.measureFieldId ?? ''}
              placeholder="Blank = count records"
              onChange={e => onChange({ ...config, measureFieldId: optionalText(e.target.value) })}
            />
          </div>
        </label>
        <label className={configFormStyles.optionRow}>
          <span className={configFormStyles.optionLabel}>Months</span>
          <div className={configFormStyles.optionControl}>
            <input
              type="number"
              min={1}
              max={36}
              className={configFormStyles.labelInput}
              value={config.bucketCount ?? 12}
              onChange={e => onChange({ ...config, bucketCount: optionalNumber(e.target.value) })}
            />
          </div>
        </label>
        <label className={configFormStyles.optionRow}>
          <span className={configFormStyles.optionLabel}>Urgent within (days)</span>
          <div className={configFormStyles.optionControl}>
            <input
              type="number"
              min={0}
              className={configFormStyles.labelInput}
              value={config.urgentWithinDays ?? ''}
              onChange={e =>
                onChange({ ...config, urgentWithinDays: optionalNumber(e.target.value) })
              }
            />
          </div>
        </label>
        <label className={configFormStyles.optionRow}>
          <span className={configFormStyles.optionLabel}>Include overdue</span>
          <div className={configFormStyles.optionControl}>
            <input
              type="checkbox"
              checked={config.foldOverdue ?? false}
              onChange={e => onChange({ ...config, foldOverdue: e.target.checked || undefined })}
            />
          </div>
        </label>
      </div>
    </DialogSection>
  </>
);

export const DATE_BUCKET_CHART_TYPE = 'DateBucketChart' as const;

const isOptionalNumber = (value: unknown): boolean =>
  value === undefined || (typeof value === 'number' && Number.isFinite(value));

export const dateBucketChartSpec: DashboardWidgetSpec<DateBucketChartWidgetConfig> = {
  icon: TbChartBar,
  label: 'Date bar chart',
  description:
    'Bars per month for a date field - record counts or a summed amount, e.g. renewals, expiries or reviews due.',
  defaultW: 12,
  defaultH: 12,
  surfaces: ['workspace'],
  component: DateBucketChartWidget,
  headerActionsComponent: DateBucketChartHeaderActions,
  isValidConfig: (config): config is DateBucketChartWidgetConfig =>
    typeof config.query === 'string' &&
    typeof config.dateFieldId === 'string' &&
    (config.measureFieldId === undefined || typeof config.measureFieldId === 'string') &&
    isOptionalNumber(config.bucketCount) &&
    isOptionalNumber(config.urgentWithinDays) &&
    (config.foldOverdue === undefined || typeof config.foldOverdue === 'boolean') &&
    isDateBucketChartConfigComplete(config as DateBucketChartWidgetConfig),
  createDefaultConfig: () => ({ query: '', dateFieldId: '' }),
  configForm: DateBucketChartConfigForm
};
