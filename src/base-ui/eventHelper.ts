export const EventHelper = {
  point: (e: { offsetX: number; offsetY: number }) => {
    return { x: e.offsetX, y: e.offsetY };
  },
  pointWithRespectTo: (e: { clientX: number; clientY: number }, el: HTMLElement | SVGElement) => {
    const rect = el.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
};
