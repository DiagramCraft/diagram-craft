import {
  Snapshot,
  UnitOfWork,
  UOWOperation,
  UOWTrackable,
  UOWTrackableParentChildSpecification,
  UOWTrackableSpecification
} from '@diagram-craft/model/unitOfWork';
import type { DiagramElement } from '@diagram-craft/model/diagramElement';
import { Diagram } from '@diagram-craft/model/diagram';
import { mustExist, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { EdgeProps } from '@diagram-craft/model/diagramProps';
import { Point } from '@diagram-craft/geometry/point';
import { FreeEndpoint } from '@diagram-craft/model/endpoint';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import { isDebug } from '@diagram-craft/utils/debug';
import { SerializedEdge, SerializedNode } from '@diagram-craft/model/serialization/serializedTypes';

declare global {
  namespace DiagramCraft {
    interface UnitOfWorkMetadata {
      invalidated?: Set<UOWTrackable>;
    }
  }
}

type ElementSnapshot = DiagramNodeSnapshot | DiagramEdgeSnapshot;
export class DiagramElementUOWSpecification implements UOWTrackableSpecification<
  ElementSnapshot,
  DiagramElement
> {
  id(e: DiagramElement): string {
    return e.id;
  }

  onBeforeCommit(operations: Array<UOWOperation>, uow: UnitOfWork): void {
    // At this point, any elements have been added and or removed
    if (!uow.isRemote) {
      const handled = new Set<string>();
      operations.forEach(({ trackable }) => {
        const el = trackable as DiagramElement;
        if (handled.has(el.id)) return;
        el.invalidate(uow);
        handled.add(el.id);
      });
    }
  }

  onNotify(operations: Array<UOWOperation>, uow: UnitOfWork): void {
    const added = operations.filter(e => e.type === 'add').map(e => e.trackable as DiagramElement);
    const updated = operations
      .filter(e => e.type === 'update')
      .map(e => e.trackable as DiagramElement);
    const removed = operations
      .filter(e => e.type === 'remove')
      .map(e => e.trackable as DiagramElement);
    uow.diagram.emit('elementBatchChange', { removed, updated, added });
  }

  update(diagram: Diagram, elementId: string, snapshot: ElementSnapshot, uow: UnitOfWork): void {
    if (isDebug()) console.log(`Updating element ${elementId}`);
    const element = mustExist(diagram.lookup(elementId));
    element.restore(snapshot, uow);
  }

  restore(snapshot: ElementSnapshot, element: DiagramElement, uow: UnitOfWork): void {
    element.restore(snapshot, uow);
  }

  snapshot(element: DiagramElement): ElementSnapshot {
    return element.snapshot() as ElementSnapshot;
  }
}

export class DiagramElementParentChildUOWSpecification implements UOWTrackableParentChildSpecification<ElementSnapshot> {
  add(
    diagram: Diagram,
    parentId: string,
    _childId: string,
    childSnapshot: ElementSnapshot,
    idx: number,
    uow: UnitOfWork
  ): void {
    const parent = mustExist(diagram.lookup(parentId));

    let child: DiagramElement;
    if (childSnapshot.type === 'node') {
      const node = ElementFactory.node(
        childSnapshot.id,
        childSnapshot.nodeType,
        childSnapshot.bounds,
        parent.layer,
        childSnapshot.props,
        childSnapshot.metadata,
        childSnapshot.texts
      );
      node.restore(childSnapshot, uow);
      child = node;
    } else if (childSnapshot.type === 'edge') {
      const edge = ElementFactory.edge(
        childSnapshot.id,
        new FreeEndpoint(Point.of(0, 0)),
        new FreeEndpoint(Point.of(0, 0)),
        childSnapshot.props as EdgeProps,
        childSnapshot.metadata,
        [],
        parent.layer
      );
      edge.restore(childSnapshot, uow);
      child = edge;
    } else {
      VERIFY_NOT_REACHED();
    }

    if (idx === -1) {
      parent.addChild(child, uow);
    } else {
      parent.addChild(child, uow, idx);
    }
  }

  remove(diagram: Diagram, parentId: string, childId: string, uow: UnitOfWork): void {
    const parent = mustExist(diagram.lookup(parentId));
    const child = mustExist(diagram.lookup(childId));
    parent.removeChild(child, uow);
  }
}

export type DiagramNodeSnapshot = Snapshot &
  Omit<SerializedNode, 'children'> & {
    _snapshotType: 'node';
    parentId?: string;
    children: string[];
  };

export type DiagramEdgeSnapshot = Snapshot &
  SerializedEdge & {
    _snapshotType: 'edge';
  };
