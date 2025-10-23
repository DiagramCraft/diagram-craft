/**
 * Find the closest ancestor of a given HTML element that has a specific class.
 *
 * @param el - The starting element from which to begin the search.
 * @param className - The class name to search for among the ancestors.
 * @returns - The closest ancestor element with the specified class,
 *  `undefined` if no such element is found
 */
export const getAncestorWithClass = (el: HTMLElement | undefined, className: string) => {
  const c = el?.closest(`.${className}`);
  return c === null ? undefined : c;
};

/**
 * Sets the position of a given HTML element.
 *
 * @param el - The element to position.
 * @param position - The position object containing x and y coordinates.
 */
export const setPosition = (el: HTMLElement, position: { x: number; y: number }) => {
  el.style.left = `${position.x}px`;
  el.style.top = `${position.y}px`;
};
