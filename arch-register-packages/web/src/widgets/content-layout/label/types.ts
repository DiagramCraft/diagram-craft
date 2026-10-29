import type { TElement } from 'platejs';

export interface LabelSlateElement extends TElement {
  // Named `content`, not `text` — a slate element field literally named `text`
  // collides with Slate's own Text-node shape ({ text: string }), which makes
  // `Text.isText()` misclassify the element and silently drops it on insert.
  content: string;
  color: string;
}
