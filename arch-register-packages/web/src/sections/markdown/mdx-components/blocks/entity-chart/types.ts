import type { TElement } from 'platejs';

export interface EntityChartSlateElement extends TElement {
  schema?: string;
  owner?: string;
  lifecycle?: string;
  groupBy?: string;
  chartType?: string;
}
