import type { TElement } from 'platejs';

export interface EntityViewEmbedSlateElement extends TElement {
  viewId?: string;
}

export type SavedViewEmbedWidgetConfig = { viewId: string };
