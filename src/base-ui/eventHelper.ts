export const EventHelper = {
  point: (e: { offsetX: number; offsetY: number }) => {
    return { x: e.offsetX, y: e.offsetY };
  }
};
