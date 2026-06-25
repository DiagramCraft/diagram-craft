import type { TElement } from 'platejs';

export interface EntityTableSlateElement extends TElement {
  schema?: string;
  owner?: string;
  lifecycle?: string;
  limit?: string;
}
