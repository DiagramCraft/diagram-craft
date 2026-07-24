import type { ExploreConnector } from './ExploreView.helpers';

export type ExploreConnectorLine = ExploreConnector & {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export const pointToSegmentDistance = (
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);

  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;
  return Math.hypot(px - closestX, py - closestY);
};

export const cubicPoint = (
  t: number,
  x1: number,
  y1: number,
  cx1: number,
  cy1: number,
  cx2: number,
  cy2: number,
  x2: number,
  y2: number
) => {
  const mt = 1 - t;
  return {
    x: mt * mt * mt * x1 + 3 * mt * mt * t * cx1 + 3 * mt * t * t * cx2 + t * t * t * x2,
    y: mt * mt * mt * y1 + 3 * mt * mt * t * cy1 + 3 * mt * t * t * cy2 + t * t * t * y2
  };
};

export const connectorDistance = (line: ExploreConnectorLine, px: number, py: number) => {
  const centerX = line.x1 + (line.x2 - line.x1) / 2;
  let minDistance = Number.POSITIVE_INFINITY;
  let previous = { x: line.x1, y: line.y1 };

  for (let i = 1; i <= 24; i++) {
    const next = cubicPoint(
      i / 24,
      line.x1,
      line.y1,
      centerX,
      line.y1,
      centerX,
      line.y2,
      line.x2,
      line.y2
    );
    minDistance = Math.min(
      minDistance,
      pointToSegmentDistance(px, py, previous.x, previous.y, next.x, next.y)
    );
    previous = next;
  }
  return minDistance;
};
