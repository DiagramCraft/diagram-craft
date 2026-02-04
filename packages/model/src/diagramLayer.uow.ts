import {
  NotificationPhase,
  Snapshot,
  UnitOfWork,
  UOWAdapter,
  UOWChildAdapter,
  UOWOperation
} from '@diagram-craft/model/unitOfWork';
import { Layer, LayerType } from '@diagram-craft/model/diagramLayer';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { Diagram } from '@diagram-craft/model/diagram';
import { mustExist, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import { AdjustmentRule } from '@diagram-craft/model/diagramLayerRuleTypes';
import { ModificationCRDT } from '@diagram-craft/model/diagramLayerModification';
import { DiagramEdgeSnapshot, DiagramNodeSnapshot } from '@diagram-craft/model/diagramElement.uow';

export class LayerUOWAdapter implements UOWAdapter<LayerSnapshot, Layer> {
  id = (layer: Layer) => layer.id;

  onNotify(operations: Array<UOWOperation>, _phase: NotificationPhase, uow: UnitOfWork): void {
    const handled = new Set<string>();
    for (const op of operations) {
      const key = `${op.type}/${op.target.id}`;
      if (handled.has(key)) continue;
      handled.add(key);

      switch (op.type) {
        case 'add':
          uow.diagram.layers.emit('layerAdded', { layer: op.target.object as Layer });
          break;
        case 'update':
          uow.diagram.layers.emit('layerUpdated', { layer: op.target.object as Layer });
          break;
        case 'remove':
          uow.diagram.layers.emit('layerRemoved', { layer: op.target.object as Layer });
          break;
      }
    }
  }

  update(diagram: Diagram, layerId: string, snapshot: LayerSnapshot, uow: UnitOfWork): void {
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

export class LayerChildUOWAdapter implements UOWChildAdapter<
  DiagramNodeSnapshot | DiagramEdgeSnapshot
> {
  add(
    diagram: Diagram,
    parentId: string,
    _childId: string,
    childSnapshot: DiagramNodeSnapshot | DiagramEdgeSnapshot,
    idx: number,
    uow: UnitOfWork
  ): void {
    const layer = mustExist(diagram.layers.byId(parentId));
    assertRegularLayer(layer);

    let child: DiagramElement;
    if (childSnapshot.type === 'node') {
      child = ElementFactory.nodeFromSnapshot(childSnapshot, layer);
      child.restore(childSnapshot, uow);
    } else if (childSnapshot.type === 'edge') {
      child = ElementFactory.edgeFromSnapshot(childSnapshot, layer);
      child.restore(childSnapshot, uow);
    } else {
      VERIFY_NOT_REACHED();
    }

    if (idx === -1) {
      layer.addElement(child, uow);
    } else {
      layer.insertElement(child, idx, uow);
    }
  }

  remove(diagram: Diagram, parentId: string, childId: string, uow: UnitOfWork): void {
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
