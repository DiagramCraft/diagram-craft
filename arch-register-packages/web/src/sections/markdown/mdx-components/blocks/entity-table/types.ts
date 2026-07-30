import type { TElement } from 'platejs';

export interface EntityTableSlateElement extends TElement {
  schema?: string;
  owner?: string;
  lifecycle?: string;
  limit?: string;
}

export type EntityTableWidgetConfig = {
  schema?: string;
  owner?: string;
  lifecycle?: string;
  limit?: number;
};
