import { DiagramElement, isEdge, isNode } from './diagramElement';
import { newid } from '@diagram-craft/utils/id';
import { Box } from '@diagram-craft/geometry/box';
import { Point, Scale } from '@diagram-craft/geometry/point';
import { UnitOfWork } from './unitOfWork';
import { serializeDiagramElement } from './serialization/serialize';
import { deepClone } from '@diagram-craft/utils/object';
import type { SerializedEdge, SerializedNode } from './serialization/serializedTypes';
import type { RegularLayer } from './diagramLayerRegular';
import { deserializeDiagramElements } from './serialization/deserialize';
import type { DiagramNode } from './diagramNode';
import type { DiagramEdge } from './diagramEdge';
import { ElementLookup } from './elementLookup';
import { groupBy } from '@diagram-craft/utils/array';

// TODO: Ensure linking between edges and nodes works
//       See ElementsPasteHandler
const assignNewIdsToSerializedElements = (e: SerializedNode | SerializedEdge) => {
  e.id = newid();
  if (e.type === 'node') {
    for (const c of e.children ?? []) {
      assignNewIdsToSerializedElements(c);
    }
  }
};

export const deleteElements = (elements: readonly DiagramElement[], uow: UnitOfWork) => {
  if (elements.length === 0) return;

  const byParent = groupBy(elements, e => e.parent);

  for (const [parent, children] of byParent) {
    if (parent === undefined) continue;
    for (const edge of children.filter(isEdge)) {
      uow.executeRemove(edge, parent, parent.children.indexOf(edge), () =>
        parent.removeChild(edge, uow)
      );
    }
    for (const node of children.filter(isNode)) {
      uow.executeRemove(node, parent, parent.children.indexOf(node), () =>
        parent.removeChild(node, uow)
      );
    }
  }

  const layer = elements[0]!.layer;
  const rootChildren = byParent.get(undefined) ?? [];
  for (const edge of rootChildren.filter(isEdge)) {
    uow.executeRemove(edge, layer, layer.elements.indexOf(edge), () =>
      layer.removeElement(edge, uow)
    );
  }
  for (const node of rootChildren.filter(isNode)) {
    uow.executeRemove(node, layer, layer.elements.indexOf(node), () =>
      layer.removeElement(node, uow)
    );
  }
};

export const cloneElements = (
  elements: readonly DiagramElement[],
  targetLayer: RegularLayer,
  uow: UnitOfWork
) => {
  const source = elements.map(e => deepClone(serializeDiagramElement(e)));

  for (const e of source) {
    assignNewIdsToSerializedElements(e);
  }

  return deserializeDiagramElements(
    source,
    targetLayer,
    uow,
    new ElementLookup<DiagramNode>(),
    new ElementLookup<DiagramEdge>()
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

export const _test = {
  assignNewIdsToSerializedElements
};
