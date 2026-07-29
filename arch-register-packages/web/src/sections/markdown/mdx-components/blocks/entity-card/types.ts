import type { TElement } from 'platejs';

export interface EntityCardSlateElement extends TElement {
  entityId: string;
  fields?: string;
}

export type EntityCardWidgetConfig = {
  entityId: string;
  fields?: string;
};
