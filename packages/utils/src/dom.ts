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
export const getAncestorWithClass = (
  el: HTMLElement | SVGElement | undefined,
  className: string
) => {
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

/**
 * Sanitizes HTML by removing potentially unsafe elements and attributes.
 *
 * This function removes:
 * - Script tags and other executable elements (iframe, object, embed, svg, etc.)
 * - Event handler attributes (onclick, onerror, onload, etc.)
 * - Dangerous URLs in href and src attributes (javascript:, data:, vbscript:)
 * - Meta refresh tags that could redirect
 *
 * @param html - The HTML string to sanitize
 * @returns The sanitized HTML string
 *
 * @example
 * ```ts
 * const userInput = '<p>Hello</p><script>alert("XSS")</script>';
 * const safe = sanitizeHtml(userInput);
 * // Returns: '<p>Hello</p>'
 * ```
 */
export const sanitizeHtml = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Remove dangerous tags
  const dangerousTags = ['script', 'iframe', 'object', 'embed', 'link', 'style', 'form', 'svg', 'meta'];
  dangerousTags.forEach(tag => {
    const elements = doc.querySelectorAll(tag);
    elements.forEach(el => el.remove());
  });

  // Dangerous URL protocols
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:'];

  // Remove event handler attributes and dangerous URLs
  const allElements = doc.querySelectorAll('*');
  allElements.forEach(el => {
    // Remove event handler attributes
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
      // Remove dangerous protocol URLs
      if (attr.name === 'href' || attr.name === 'src') {
        const value = attr.value.trim().toLowerCase();
        for (const protocol of dangerousProtocols) {
          if (value.startsWith(protocol)) {
            el.removeAttribute(attr.name);
            break;
          }
        }
      }
    });
  });

  return doc.body.innerHTML;
};
