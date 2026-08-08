import styles from './MapLegend.module.css';
import type {
  MetricAggregation,
  MetricLegend,
  MetricSource
} from '@arch-register/api-types/metricContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import { categoricalColor, NEUTRAL_MISSING_COLOR } from './mapColorScales';
import { isEnumSource } from './mapMetricConfig';
import { formatMetricLegendValue, formatMetricRateDate } from './mapMetricFormatting';

type MapLegendProps = {
  metricLabel: string;
  source: MetricSource;
  aggregation: MetricAggregation;
  legend: MetricLegend;
  lifecycleStates: WorkspaceLifecycleState[];
};

export const MapLegend = ({
  metricLabel,
  source,
  aggregation,
  legend,
  lifecycleStates
}: MapLegendProps) => {
  if (aggregation !== 'percentage' && isEnumSource(source)) {
    const categories = legend.categories ?? [];
    return (
      <div className={styles.legend}>
        <span className={styles.title}>{metricLabel}</span>
        <div className={styles.row}>
          {categories.map((category, index) => (
            <span key={category.value} className={styles.item}>
              <span className={styles.swatch} style={{ background: categoricalColor(index) }} />
              {category.label}
            </span>
          ))}
          <span className={styles.item}>
            <span className={styles.swatch} style={{ background: NEUTRAL_MISSING_COLOR }} />
            No data
          </span>
        </div>
      </div>
    );
  }

  if (aggregation !== 'percentage' && source.kind === 'lifecycle') {
    const sorted = [...lifecycleStates].sort((a, b) => a.sort_order - b.sort_order);
    return (
      <div className={styles.legend}>
        <span className={styles.title}>{metricLabel}</span>
        <div className={styles.row}>
          {sorted.map(state => (
            <span key={state.id} className={styles.item}>
              <span
                className={styles.swatch}
                style={{ background: state.color ?? NEUTRAL_MISSING_COLOR }}
              />
              {state.label}
            </span>
          ))}
          <span className={styles.item}>
            <span className={styles.swatch} style={{ background: NEUTRAL_MISSING_COLOR }} />
            No data
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.legend}>
      <span className={styles.title}>
        {metricLabel}
        {legend.currencyMixed ? ' (Unconverted)' : ''}
        {legend.currencyCode ? ` · ${legend.currencyCode}` : ''}
        {formatMetricRateDate(legend) ? ` · ${formatMetricRateDate(legend)}` : ''}
      </span>
      <div className={styles.row}>
        <span className={styles.rangeLabel}>
          {formatMetricLegendValue(legend.min, legend, aggregation)}
        </span>
        <span
          className={styles.gradient}
          style={{ background: 'linear-gradient(to right, #86b6ef, #0d366b)' }}
        />
        <span className={styles.rangeLabel}>
          {formatMetricLegendValue(legend.max, legend, aggregation)}
        </span>
        <span className={styles.item}>
          <span className={styles.swatch} style={{ background: NEUTRAL_MISSING_COLOR }} />
          No data
        </span>
      </div>
    </div>
  );
};
