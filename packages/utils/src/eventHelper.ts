export const EventHelper = {
  /**
   * Returns the point of the event
   * @param e
   */
  point: (e: { offsetX: number; offsetY: number }) => {
    return { x: e.offsetX, y: e.offsetY };
  },

  // TODO: Not sure if this is actually needed much - should be better
  //       to use offsetX/offsetY in most cases
  /**
   * Returns the point of the event with respect to the element
   * @param e event
   * @param el element
   */
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
