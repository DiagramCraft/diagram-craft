import { DiagramElement, isNode } from '../diagramElement';
import { newid } from '@diagram-craft/utils/id';
import { Box } from '@diagram-craft/geometry/box';
import { Point, Scale } from '@diagram-craft/geometry/point';
import { UnitOfWork } from '../unitOfWork';
import { Mutable } from '@diagram-craft/utils/types';

// TODO: Ensure linking between edges and nodes works
//       See ElementsPasteHandler
export const assignNewIds = (elements: readonly DiagramElement[]) => {
  for (const e of elements) {
    (e as Mutable<DiagramElement>).id = newid();
    if (isNode(e)) {
      assignNewIds(e.children);
    }
  }
};

export const assignNewBounds = (
  elements: readonly DiagramElement[],
  position: Point,
  scale: Scale,
  uow: UnitOfWork
) => {
  const process = (elements: readonly DiagramElement[], parentBounds: Box) => {
    for (const e of elements) {
      e.setBounds(
        {
          x: (e.bounds.x - parentBounds.x) * scale.x + position.x,
          y: (e.bounds.y - parentBounds.y) * scale.y + position.y,
          w: e.bounds.w * scale.x,
          h: e.bounds.h * scale.y,
          r: e.bounds.r
        },
        uow
      );
      if (isNode(e)) {
        process(e.children, parentBounds);
      }
    }
  };
  process(elements, Box.boundingBox(elements.map(e => e.bounds)));
};
