export const EventHelper = {
  /**
   * Returns the point of the event
   * @param e
   */
  point: (e: { offsetX: number; offsetY: number }) => {
    return { x: e.offsetX, y: e.offsetY };
  },

  /**
   * Returns the point of the event with respect to the element
   * @param e event
   * @param el element
   */
  pointWithRespectTo: (e: { clientX: number; clientY: number }, el: HTMLElement | SVGElement) => {
    const rect = el.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
};
