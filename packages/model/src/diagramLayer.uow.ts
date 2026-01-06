import {
  LayerSnapshot,
  UnitOfWork,
  UOWTrackableSpecification
} from '@diagram-craft/model/unitOfWork';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { Diagram } from '@diagram-craft/model/diagram';
import { mustExist } from '@diagram-craft/utils/assert';

export class LayerUOWSpecification implements UOWTrackableSpecification<LayerSnapshot, Layer> {
  addElement(layer: Layer, child: DiagramElement, _idx: number, uow: UnitOfWork): void {
    assertRegularLayer(layer);
    // TODO: Support for idx
    layer.addElement(child, uow);
  }

  onAfterCommit(_layers: Array<Layer>, _uow: UnitOfWork): void {}

  onBeforeCommit(_layers: Array<Layer>, _uow: UnitOfWork): void {}

  removeElement(layer: Layer, child: DiagramElement, uow: UnitOfWork): void {
    assertRegularLayer(layer);
    layer.removeElement(child, uow);
  }

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

  children(_element: Layer) {
    return [];
  }
}
