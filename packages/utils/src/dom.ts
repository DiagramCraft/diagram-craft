/**
 * DOM manipulation utilities.
 *
 * @example
 * ```ts
 * import { getAncestorWithClass, setPosition } from '@diagram-craft/utils/dom';
 *
 * const container = getAncestorWithClass(element, 'container');
 * setPosition(tooltip, { x: 100, y: 200 });
 * ```
 *
 * @module
 */

/**
 * Finds the closest ancestor element that has a specific class name.
 *
 * This is a wrapper around the native `closest()` method that searches up the DOM tree
 * for an element with the specified class.
 *
 * @param el - The starting element from which to begin the search
 * @param className - The class name to search for (without the dot prefix)
 * @returns The closest ancestor element with the specified class, or undefined if not found
 *
 * @example
 * ```ts
 * const button = document.querySelector('button');
 * const modal = getAncestorWithClass(button, 'modal');
 * ```
 */
export const getAncestorWithClass = (el: HTMLElement | undefined, className: string) => {
  const c = el?.closest(`.${className}`);
  return c === null ? undefined : c;
};

/**
 * Sets the absolute position of an element using left and top CSS properties.
 *
 * Useful for positioning tooltips, popups, or absolutely positioned elements.
 * Note that the element should have `position: absolute` or `position: fixed`
 * in its CSS for this to work as expected.
 *
 * @param el - The element to position
 * @param position - The position coordinates in pixels
 * @param position.x - The left position
 * @param position.y - The top position
 *
 * @example
 * ```ts
 * const tooltip = document.getElementById('tooltip');
 * setPosition(tooltip, { x: 150, y: 300 });
 * // Sets: element.style.left = '150px' and element.style.top = '300px'
 * ```
 */
export const setPosition = (el: HTMLElement, position: { x: number; y: number }) => {
  el.style.left = `${position.x}px`;
  el.style.top = `${position.y}px`;
};
