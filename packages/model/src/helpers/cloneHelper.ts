import { DiagramElement, isNode } from '../diagramElement';
import { newid } from '@diagram-craft/utils/id';
import { Box } from '@diagram-craft/geometry/box';
import { Point } from '@diagram-craft/geometry/point';
import { Diagram } from '../diagram';
import { UnitOfWork } from '../unitOfWork';

export const assignNewIds = (elements: readonly DiagramElement[]) => {
  for (const e of elements) {
    e.id = newid();
    if (isNode(e)) {
      assignNewIds(e.children);
    }
  }
};

export const assignNewBounds = (
  elements: readonly DiagramElement[],
  point: Point,
  scaleX: number,
  scaleY: number,
  $d: Diagram,
  uow: UnitOfWork,
  parentBounds?: Box
) => {
  const bounds = parentBounds ?? Box.boundingBox(elements.map(e => e.bounds));
  for (const e of elements) {
    e.setBounds(
      {
        x: (e.bounds.x - bounds.x) * scaleX + point.x,
        y: (e.bounds.y - bounds.y) * scaleY + point.y,
        w: e.bounds.w * scaleX,
        h: e.bounds.h * scaleY,
        r: e.bounds.r
      },
      uow
    );
    if (isNode(e)) {
      assignNewBounds(e.children, point, scaleX, scaleY, $d, uow, bounds);
    }
  }
};
