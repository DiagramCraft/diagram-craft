import type { TElement } from 'platejs';

export interface EntityChangelogSlateElement extends TElement {
  entityId?: string;
  schema?: string;
  owner?: string;
  lifecycle?: string;
  limit?: string;
  since?: string;
}

export type EntityChangelogWidgetConfig = {
  entityId?: string;
  schema?: string;
  owner?: string;
  lifecycle?: string;
  limit?: string;
  since?: string;
};
