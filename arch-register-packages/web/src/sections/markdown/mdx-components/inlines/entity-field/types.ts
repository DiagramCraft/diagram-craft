import type { TElement } from 'platejs';

export interface EntityFieldSlateElement extends TElement {
  entityId: string;
  field: string;
}
