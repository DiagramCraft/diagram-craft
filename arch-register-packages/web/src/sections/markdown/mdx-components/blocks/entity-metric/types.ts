import type { TElement } from 'platejs';

/**
 * What the metric counts. Absent (or `'entity-count'`) preserves the original
 * behavior: counting entities filtered by schema/owner/lifecycle.
 */
export type EntityMetricType =
  | 'entity-count'
  | 'project-count'
  | 'diagram-count'
  | 'completeness-percent';

export interface EntityMetricSlateElement extends TElement {
  schema?: string;
  owner?: string;
  lifecycle?: string;
  label?: string;
  metricType?: EntityMetricType;
}

export type StatMetricWidgetConfig = {
  metricType: EntityMetricType;
  schema?: string;
  owner?: string;
  lifecycle?: string;
  label?: string;
};
