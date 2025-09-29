import { DiagramElement, isNode } from '../diagramElement';
import { newid } from '@diagram-craft/utils/id';
import { Box } from '@diagram-craft/geometry/box';
import { Point, Scale } from '@diagram-craft/geometry/point';
import { UnitOfWork } from '../unitOfWork';
import { serializeDiagramElement } from '../serialization/serialize';
import { deepClone } from '@diagram-craft/utils/object';
import type { SerializedEdge, SerializedNode } from '../serialization/types';
import type { RegularLayer } from '../diagramLayerRegular';
import { deserializeDiagramElements } from '../serialization/deserialize';

// TODO: Ensure linking between edges and nodes works
//       See ElementsPasteHandler
export const assignNewIdsToSerializedElements = (e: SerializedNode | SerializedEdge) => {
  e.id = newid();
  if (e.type === 'node') {
    for (const c of e.children ?? []) {
      assignNewIdsToSerializedElements(c);
    }
  }
};

export const cloneElements = (
  elements: readonly DiagramElement[],
  targetLayer: RegularLayer,
  uow: UnitOfWork
) => {
  const source = elements.map(e => {
    return deepClone(serializeDiagramElement(e));
  });

  for (const e of source) {
    assignNewIdsToSerializedElements(e);
  }

  return deserializeDiagramElements(
    source,
    targetLayer.diagram,
    targetLayer,
    new Map(),
    new Map(),
    uow
  );
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
