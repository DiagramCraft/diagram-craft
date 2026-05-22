import {
  Snapshot,
  UnitOfWork,
  UOWOperation,
  UOWChildAdapter,
  UOWAdapter,
  NotificationPhase
} from '@diagram-craft/model/unitOfWork';
import { LayerManager } from '@diagram-craft/model/diagramLayerManager';
import { Diagram } from '@diagram-craft/model/diagram';
import { mustExist } from '@diagram-craft/utils/assert';
import { isDebug } from '@diagram-craft/utils/debug';
import { LayerSnapshot } from '@diagram-craft/model/diagramLayer.uow';

export class LayerManagerChildUOWAdapter implements UOWChildAdapter<LayerSnapshot> {
  add(
    diagram: Diagram,
    _parentId: string,
    childId: string,
    childSnapshot: LayerSnapshot,
    idx: number,
    uow: UnitOfWork
  ): void {
    if (isDebug()) console.log(`Adding layer ${childId}`);

    const child = mustExist(childSnapshot._ref);
    child.restore(childSnapshot, uow);

    const layerManager = diagram.layers;
    if (idx === -1) {
      layerManager.add(child, uow);
    } else {
      layerManager.insert(child, idx, uow);
    }
  }

  remove(diagram: Diagram, _parentId: string, child: string, uow: UnitOfWork): void {
    if (isDebug()) console.log(`Removing layer ${child}`);

    const layerManager = diagram.layers;
    const layer = mustExist(layerManager.byId(child));
    layerManager.remove(layer, uow);
  }
}

export class LayerManagerUOWAdapter implements UOWAdapter<LayersSnapshot, LayerManager> {
  id = () => 'layerManager';

  onNotify(_operations: Array<UOWOperation>, _phase: NotificationPhase, uow: UnitOfWork): void {
    uow.diagram.layers.emit('layerStructureChange', {});
  }

  update(diagram: Diagram, _elementId: string, snapshot: LayersSnapshot, uow: UnitOfWork): void {
    const layerManager = diagram.layers;
    layerManager._restore(snapshot, uow);
  }

  restore(snapshot: LayersSnapshot, element: LayerManager, uow: UnitOfWork): void {
    element._restore(snapshot, uow);
  }

  snapshot(element: LayerManager): LayersSnapshot {
    return element._snapshot();
  }
}

export interface LayersSnapshot extends Snapshot {
  _snapshotType: 'layers';
  layers: string[];
  visibleLayers: string[];
}
