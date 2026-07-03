import type { TElement } from 'platejs';

export interface CaptionSlateElement extends TElement {
  caption?: string;
  align?: string;
  numbered?: boolean;
}
