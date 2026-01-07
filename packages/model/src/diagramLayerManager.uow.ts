import {
  LayerSnapshot,
  LayersSnapshot,
  UnitOfWork,
  UOWTrackableParentChildSpecification,
  UOWTrackableSpecification
} from '@diagram-craft/model/unitOfWork';
import { LayerManager } from '@diagram-craft/model/diagramLayerManager';
import { Diagram } from '@diagram-craft/model/diagram';
import { mustExist } from '@diagram-craft/utils/assert';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { RuleLayer } from '@diagram-craft/model/diagramLayerRule';
import { ReferenceLayer } from '@diagram-craft/model/diagramLayerReference';
import { ModificationLayer } from '@diagram-craft/model/diagramLayerModification';

export class LayerManagerParentChildUOWSpecification implements UOWTrackableParentChildSpecification<LayerSnapshot> {
  addElement(
    diagram: Diagram,
    _parentId: string,
    childId: string,
    childSnapshot: LayerSnapshot,
    _idx: number,
    uow: UnitOfWork
  ): void {
    // TODO: Add support for idx

    let child: Layer;
    switch (childSnapshot.type) {
      case 'regular':
        child = new RegularLayer(childId, childSnapshot.name, [], diagram);
        child.restore(childSnapshot, uow);
        break;
      case 'rule':
        child = new RuleLayer(childId, childSnapshot.name, diagram, []);
        child.restore(childSnapshot, uow);
        break;
      case 'reference':
        child = new ReferenceLayer(childId, childSnapshot.name, diagram, undefined!);
        child.restore(childSnapshot, uow);
        break;
      case 'modification':
        child = new ModificationLayer(childId, childSnapshot.name, diagram, []);
        child.restore(childSnapshot, uow);
        break;
      default:
        throw new Error(`Unsupported layer type: ${childSnapshot.type}`);
    }

    const layerManager = diagram.layers;
    layerManager.add(child, uow);
  }

  removeElement(diagram: Diagram, _parentId: string, child: string, uow: UnitOfWork): void {
    const layerManager = diagram.layers;
    const layer = mustExist(layerManager.byId(child));
    layerManager.remove(layer, uow);
  }
}

export class LayerManagerUOWSpecification implements UOWTrackableSpecification<
  LayersSnapshot,
  LayerManager
> {
  updateElement(
    diagram: Diagram,
    _elementId: string,
    snapshot: LayersSnapshot,
    uow: UnitOfWork
  ): void {
    const layerManager = diagram.layers;
    layerManager._restore(snapshot, uow);
  }

  onAfterCommit(_layerManagers: Array<LayerManager>, _uow: UnitOfWork): void {}

  onBeforeCommit(_layerManagers: Array<LayerManager>, _uow: UnitOfWork): void {}

  restore(snapshot: LayersSnapshot, element: LayerManager, uow: UnitOfWork): void {
    element._restore(snapshot, uow);
  }

  snapshot(element: LayerManager): LayersSnapshot {
    return element._snapshot();
  }
}
