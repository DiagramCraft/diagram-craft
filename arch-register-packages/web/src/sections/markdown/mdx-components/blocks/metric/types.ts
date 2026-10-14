import type { TElement } from 'platejs';
import { z } from 'zod';
import { withInitial } from '../../configSchema';

/**
 * What the metric counts. Absent (or `'entity-count'`) preserves the original
 * behavior: counting entities filtered by schema/owner/lifecycle.
 */
export const metricTypeSchema = z.enum([
  'entity-count',
  'project-count',
  'diagram-count',
  'completeness-percent'
]);

export type MetricType = z.infer<typeof metricTypeSchema>;

export interface MetricSlateElement extends TElement {
  schema?: string;
  owner?: string;
  lifecycle?: string;
  label?: string;
  metricType?: MetricType;
  showLink?: boolean;
}

export const statMetricWidgetConfigSchema = z.object({
  metricType: withInitial(metricTypeSchema, 'entity-count'),
  schema: z.string().optional(),
  owner: z.string().optional(),
  lifecycle: z.string().optional(),
  label: z.string().optional(),
  showLink: z.boolean().optional()
});

export type StatMetricWidgetConfig = z.infer<typeof statMetricWidgetConfigSchema>;
