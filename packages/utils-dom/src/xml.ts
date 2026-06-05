/**
 * XML/DOM element utilities.
 *
 * @example
 * ```ts
 * import { xIterElements, xNum } from '@diagram-craft/utils-dom/xml';
 *
 * const elements = document.getElementsByTagName('div');
 * for (const el of xIterElements(elements)) {
 *   const width = xNum(el, 'width', 100);
 * }
 * ```
 *
 * @module
 */

export function* xIterElements(collection: HTMLCollectionOf<Element>) {
  for (let i = 0; i < collection.length; i++) {
    const $cell = collection.item(i)!;
    if ($cell.nodeType !== Node.ELEMENT_NODE) continue;
    yield $cell;
  }
}

export const xNum = (el: Element, name: string, def = 0) => {
  const value = el.getAttribute(name);
  if (value === null || value.trim() === '') return def;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : def;
};
