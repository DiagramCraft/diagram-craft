import type { TElement } from 'platejs';

/**
 * What the metric counts. Absent (or `'entity-count'`) preserves the original
 * behavior: counting entities filtered by schema/owner/lifecycle.
 */
export type MetricType =
  | 'entity-count'
  | 'project-count'
  | 'diagram-count'
  | 'completeness-percent';

export interface MetricSlateElement extends TElement {
  schema?: string;
  owner?: string;
  lifecycle?: string;
  label?: string;
  metricType?: MetricType;
  showLink?: boolean;
}

export type StatMetricWidgetConfig = {
  metricType: MetricType;
  schema?: string;
  owner?: string;
  lifecycle?: string;
  label?: string;
  showLink?: boolean;
};
