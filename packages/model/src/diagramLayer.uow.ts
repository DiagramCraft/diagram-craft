import {
  Snapshot,
  UnitOfWork,
  UOWTrackableParentChildSpecification,
  UOWTrackableSpecification
} from '@diagram-craft/model/unitOfWork';
import { Layer, LayerType } from '@diagram-craft/model/diagramLayer';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { Diagram } from '@diagram-craft/model/diagram';
import { mustExist } from '@diagram-craft/utils/assert';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import { FreeEndpoint } from '@diagram-craft/model/endpoint';
import { Point } from '@diagram-craft/geometry/point';
import { EdgeProps } from '@diagram-craft/model/diagramProps';
import { isDebug } from '@diagram-craft/utils/debug';
import { AdjustmentRule } from '@diagram-craft/model/diagramLayerRuleTypes';
import { ModificationCRDT } from '@diagram-craft/model/diagramLayerModification';
import { DiagramEdgeSnapshot, DiagramNodeSnapshot } from '@diagram-craft/model/diagramElement.uow';

export class LayerUOWSpecification implements UOWTrackableSpecification<LayerSnapshot, Layer> {
  id(layer: Layer): string {
    return layer.id;
  }

  invalidate(_layer: Layer, _uow: UnitOfWork): void {
    // Nothing for now...
  }

  onCommit(_layers: Array<Layer>, _uow: UnitOfWork): void {}

  updateElement(diagram: Diagram, layerId: string, snapshot: LayerSnapshot, uow: UnitOfWork): void {
    const layer = mustExist(diagram.layers.byId(layerId));
    layer.restore(snapshot, uow);
  }

  restore(snapshot: LayerSnapshot, element: Layer, uow: UnitOfWork): void {
    element.restore(snapshot, uow);
  }

  snapshot(element: Layer): LayerSnapshot {
    return element.snapshot();
  }
}

export class LayerParentChildUOWSpecification implements UOWTrackableParentChildSpecification<
  DiagramNodeSnapshot | DiagramEdgeSnapshot
> {
  addElement(
    diagram: Diagram,
    parentId: string,
    _childId: string,
    childSnapshot: DiagramNodeSnapshot | DiagramEdgeSnapshot,
    idx: number,
    uow: UnitOfWork
  ): void {
    if (isDebug()) console.log(`Adding element ${childSnapshot.id} to layer ${parentId} at ${idx}`);

    const layer = mustExist(diagram.layers.byId(parentId));
    assertRegularLayer(layer);

    let child: DiagramElement;
    if (childSnapshot.type === 'node') {
      child = ElementFactory.node(
        childSnapshot.id,
        childSnapshot.nodeType,
        childSnapshot.bounds,
        layer,
        childSnapshot.props,
        childSnapshot.metadata,
        childSnapshot.texts
      );
      child.restore(childSnapshot, uow);
    } else {
      child = ElementFactory.edge(
        childSnapshot.id,
        new FreeEndpoint(Point.of(0, 0)),
        new FreeEndpoint(Point.of(0, 0)),
        childSnapshot.props as EdgeProps,
        childSnapshot.metadata,
        [],
        layer
      );
      child.restore(childSnapshot, uow);
    }

    if (idx === -1) {
      layer.addElement(child, uow);
    } else {
      layer.insertElement(child, idx, uow);
    }
  }

  removeElement(diagram: Diagram, parentId: string, childId: string, uow: UnitOfWork): void {
    if (isDebug()) console.log(`Removing element ${childId} from layer ${parentId}`);

    const layer = mustExist(diagram.layers.byId(parentId));
    assertRegularLayer(layer);

    const child = mustExist(diagram.lookup(childId));
    layer.removeElement(child, uow);
  }
}

export interface LayerSnapshot extends Snapshot {
  _snapshotType: 'layer';
  name: string;
  locked: boolean;
  elements?: string[];
  type: LayerType;
  rules?: AdjustmentRule[];
  modifications?: Array<Pick<ModificationCRDT, 'id' | 'type'> & { elementId?: string }>;
}
