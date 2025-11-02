/**
 * XML/DOM element utilities.
 *
 * @example
 * ```ts
 * import { xIterElements, xNum } from '@diagram-craft/utils/xml';
 *
 * const elements = document.getElementsByTagName('div');
 * for (const el of xIterElements(elements)) {
 *   const width = xNum(el, 'width', 100);
 * }
 * ```
 *
 * @module
 */

/**
 * Iterates over an HTMLCollection, yielding only element nodes.
 *
 * @param collection - The HTMLCollection to iterate over
 * @yields Element nodes from the collection
 *
 * @example
 * ```ts
 * const divs = document.getElementsByTagName('div');
 * for (const div of xIterElements(divs)) {
 *   console.log(div.id);
 * }
 * ```
 */
export function* xIterElements(collection: HTMLCollectionOf<Element>) {
  for (let i = 0; i < collection.length; i++) {
    const $cell = collection.item(i)!;
    if ($cell.nodeType !== Node.ELEMENT_NODE) continue;
    yield $cell;
  }
}

/**
 * Extracts a numeric attribute value from an element.
 *
 * @param el - The element to read from
 * @param name - The attribute name
 * @param def - Default value if attribute is missing or invalid (default: 0)
 * @returns The numeric value of the attribute
 *
 * @example
 * ```ts
 * const svg = document.querySelector('svg');
 * const width = xNum(svg, 'width', 100);
 * const height = xNum(svg, 'height', 100);
 * ```
 */
export const xNum = (el: Element, name: string, def = 0) => {
  return Number(el.getAttribute(name) ?? def);
};
