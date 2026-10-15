import type { TElement } from 'platejs';

export interface ImageEmbedSlateElement extends TElement {
  fileId: string;
  alt?: string;
  size?: string;
  align?: string;
}
