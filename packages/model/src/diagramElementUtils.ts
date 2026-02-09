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
import { isSerializedEndpointAnchor, isSerializedEndpointPointInNode } from './serialization/utils';

const assignNewIdsToSerializedElements = (
  elements: ReadonlyArray<SerializedNode | SerializedEdge>
): Map<string, string> => {
  const nodeIdMapping = new Map<string, string>();

  // Recursive function to assign new IDs to nodes and build the mapping
  const assignNodeIds = (e: SerializedNode | SerializedEdge) => {
    const oldId = e.id;
    const newId = newid();
    e.id = newId;

    if (e.type === 'node' || e.type === 'delegating-node') {
      nodeIdMapping.set(oldId, newId);
      for (const c of e.children ?? []) {
        assignNodeIds(c);
      }
    }
  };

  // Update edge endpoints to reference new node IDs
  const updateEdgeReferences = (e: SerializedNode | SerializedEdge) => {
    if (e.type === 'edge' || e.type === 'delegating-edge') {
      if (isSerializedEndpointAnchor(e.start) || isSerializedEndpointPointInNode(e.start)) {
        const newId = nodeIdMapping.get(e.start.node.id);
        if (newId) {
          e.start.node = { id: newId };
        } else {
          // Node not in cloned set - convert to free endpoint
          e.start = { position: e.start.position! };
        }
      }
      if (isSerializedEndpointAnchor(e.end) || isSerializedEndpointPointInNode(e.end)) {
        const newId = nodeIdMapping.get(e.end.node.id);
        if (newId) {
          e.end.node = { id: newId };
        } else {
          // Node not in cloned set - convert to free endpoint
          e.end = { position: e.end.position! };
        }
      }
    }

    // Recursively handle children
    if ((e.type === 'node' || e.type === 'delegating-node') && e.children) {
      for (const c of e.children) {
        updateEdgeReferences(c);
      }
    }
  };

  // First pass: assign new IDs to all nodes and edges
  for (const e of elements) {
    assignNodeIds(e);
  }

  // Second pass: update edge endpoint references
  for (const e of elements) {
    updateEdgeReferences(e);
  }

  return nodeIdMapping;
};

export const deleteElements = (elements: readonly DiagramElement[], uow: UnitOfWork) => {
  if (elements.length === 0) return;

  const byParent = groupBy(elements, e => e.parent);

  for (const [parent, children] of byParent) {
    if (parent === undefined) continue;
    for (const edge of children.filter(isEdge)) {
      parent.removeChild(edge, uow);
    }
    for (const node of children.filter(isNode)) {
      parent.removeChild(node, uow);
    }
  }

  const layer = elements[0]!.layer;
  const rootChildren = byParent.get(undefined) ?? [];
  for (const edge of rootChildren.filter(isEdge)) {
    layer.removeElement(edge, uow);
  }
  for (const node of rootChildren.filter(isNode)) {
    layer.removeElement(node, uow);
  }
};

export const cloneElements = (
  elements: readonly DiagramElement[],
  targetLayer: RegularLayer,
  uow?: UnitOfWork
) => {
  const cb = (uow: UnitOfWork) => {
    const source = elements.map(e => deepClone(serializeDiagramElement(e)));

    assignNewIdsToSerializedElements(source);

    return deserializeDiagramElements(
      source,
      targetLayer,
      uow,
      undefined,
      new ElementLookup<DiagramNode>(),
      new ElementLookup<DiagramEdge>()
    );
  };

  return uow ? cb(uow) : UnitOfWork.executeSilently(targetLayer.diagram, cb);
};

export const addAllChildren = (el: DiagramElement, uow: UnitOfWork) => {
  let idx = 0;
  for (const child of el.children) {
    uow.executeAdd(child, el, idx++, () => {});
    addAllChildren(child, uow);
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

export const _test = {
  assignNewIdsToSerializedElements
};
