/**
 * DOM manipulation utilities.
 *
 * @example
 * ```ts
 * import { getAncestorWithClass, resolveTargetElement, setPosition } from '@diagram-craft/utils-dom/dom';
 *
 * const container = getAncestorWithClass(element, 'container');
 * const target = resolveTargetElement(event.target);
 * setPosition(tooltip, { x: 100, y: 200 });
 * ```
 *
 * @module
 */

export const getAncestorWithClass = (
  el: HTMLElement | SVGElement | undefined,
  className: string
) => {
  const c = el?.closest(`.${className}`);
  return c === null ? undefined : c;
};

export const resolveTargetElement = (
  target: EventTarget | null
): HTMLElement | SVGElement | null => {
  if (typeof target !== 'object' || target === null) return null;
  if (target instanceof HTMLElement || target instanceof SVGElement) return target;
  if (target instanceof Node) {
    const parent = target.parentElement;
    return parent === null ? null : (parent as HTMLElement | SVGElement);
  }
  return null;
};

export const setPosition = (el: HTMLElement, position: { x: number; y: number }) => {
  el.style.left = `${position.x}px`;
  el.style.top = `${position.y}px`;
};

export const sanitizeHtml = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const dangerousTags = [
    'script',
    'iframe',
    'object',
    'embed',
    'link',
    'style',
    'form',
    'svg',
    'meta'
  ];
  dangerousTags.forEach(tag => {
    const elements = doc.querySelectorAll(tag);
    elements.forEach(el => el.remove());
  });

  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:'];

  const allElements = doc.querySelectorAll('*');
  allElements.forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
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

export const resolveCssColor = (
  color: string,
  elementsToTry: ReadonlyArray<HTMLElement | null | undefined>
) => {
  const match = color.match(/^var\(\s*(--[^,\s)]+)\s*(?:,\s*([^)]+))?\)$/);
  if (!match || typeof document === 'undefined') {
    return color;
  }

  const [, variableName, fallback] = match;
  for (const element of elementsToTry) {
    const resolved = element
      ? getComputedStyle(element).getPropertyValue(variableName!).trim()
      : '';
    if (resolved !== '') {
      return resolved;
    }
  }

  return fallback?.trim() ?? color;
};
