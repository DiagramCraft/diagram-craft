import type { TElement } from 'platejs';

export interface EntityMetricSlateElement extends TElement {
  schema?: string;
  owner?: string;
  lifecycle?: string;
  label?: string;
}
