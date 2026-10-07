import { useMemo } from 'react';
import { useQueryTextEntities } from '../../../hooks/useEntityQueryText';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { buildDateBuckets } from './dateBucketLogic';
import { formatMeasured } from './fieldAggregation';
import rowStyles from './WidgetRowList.module.css';
import styles from './DateBucketChartWidget.module.css';

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
  label?: string;
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
