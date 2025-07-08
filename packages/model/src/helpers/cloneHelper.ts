import { DiagramElement, isNode } from '../diagramElement';
import { newid } from '@diagram-craft/utils/id';
import { Box } from '@diagram-craft/geometry/box';
import { Point, Scale } from '@diagram-craft/geometry/point';
import { UnitOfWork } from '../unitOfWork';
import { serializeDiagramElement } from '../serialization/serialize';
import { deepClone } from '@diagram-craft/utils/object';
import type { SerializedEdge, SerializedNode } from '../serialization/types';

// TODO: Ensure linking between edges and nodes works
//       See ElementsPasteHandler
const assignNewIdsToSerializedElements = (e: SerializedNode | SerializedEdge) => {
  e.id = newid();
  if (e.type === 'node') {
    const n = e as SerializedNode;
    for (const c of n?.children ?? []) {
      assignNewIdsToSerializedElements(c);
    }
  }
};

export const cloneElements = (elements: readonly DiagramElement[]) => {
  const source = elements.map(e => deepClone(serializeDiagramElement(e)));

  for (const e of source) {
    assignNewIdsToSerializedElements(e);
  }

  return source;
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
