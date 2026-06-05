/**
 * DOM event coordinate extraction utilities.
 *
 * @example
 * ```ts
 * import { EventHelper } from '@diagram-craft/utils-dom/eventHelper';
 *
 * element.addEventListener('click', e => {
 *   const point = EventHelper.point(e);
 *   console.log(point.x, point.y);
 * });
 * ```
 *
 * @module
 */

/** @namespace */
export const EventHelper = {
  point: (e: { offsetX: number; offsetY: number }) => {
    return { x: e.offsetX, y: e.offsetY };
  },

  pointWithRespectTo: (
    e: { clientX: number; clientY: number } | { x: number; y: number },
    el: HTMLElement | SVGElement
  ) => {
    const rect = el.getBoundingClientRect();
    return {
      x: ('clientX' in e ? e.clientX : e.x) - rect.left,
      y: ('clientY' in e ? e.clientY : e.y) - rect.top
    };
  }
};
