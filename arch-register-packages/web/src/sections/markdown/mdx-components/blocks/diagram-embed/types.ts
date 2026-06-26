import type { TElement } from 'platejs';

export interface DiagramEmbedSlateElement extends TElement {
  fileId: string;
  caption?: string;
}
