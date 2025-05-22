import { Point } from '@diagram-craft/geometry/point';

/**
 * Find the closest ancestor of a given HTML element that has a specific class.
 *
 * @param el - The starting element from which to begin the search.
 * @param className - The class name to search for among the ancestors.
 * @returns - The closest ancestor element with the specified class,
 *  `undefined` if no such element is found
 */
export const getAncestorWithClass = (el: HTMLElement, className: string) => {
  if (!el) return undefined;

  let targetElement: HTMLElement | null = el;
  while (targetElement) {
    if (targetElement.classList.contains(className)) {
      return targetElement;
    }
    targetElement = targetElement.parentElement;
  }
  return undefined;
};

/**
 * Sets the position of a given HTML element.
 *
 * @param el - The element to position.
 * @param position - The position object containing x and y coordinates.
 */
export const setPosition = (el: HTMLElement, position: Point) => {
  el.style.left = `${position.x}px`;
  el.style.top = `${position.y}px`;
};
