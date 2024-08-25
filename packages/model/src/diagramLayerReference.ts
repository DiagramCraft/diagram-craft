import { assertRegularLayer, Layer } from './diagramLayer';
import { Diagram } from './diagram';
import { LayerSnapshot, UnitOfWork } from './unitOfWork';

type LayerReference = {
  layerId: string;
  diagramId: string;
};

type RegularLayerSnapshot = LayerSnapshot & {
  reference: LayerReference;
};

export class ReferenceLayer extends Layer {
  #reference: LayerReference;

  constructor(id: string, name: string, diagram: Diagram, reference: LayerReference) {
    super(id, name, diagram, 'reference');
    this.#reference = reference;
  }

  isLocked(): boolean {
    return true;
  }

  get reference() {
    return this.#reference;
  }

  get elements() {
    return this.getReferencedLayer().elements;
  }

  private getReferencedLayer() {
    const layer = this.diagram.document
      .getById(this.reference.diagramId)!
      .layers.byId(this.reference.layerId)!;
    assertRegularLayer(layer);
    return layer;
  }

  restore(snapshot: RegularLayerSnapshot, uow: UnitOfWork) {
    super.restore(snapshot, uow);
    this.#reference = snapshot.reference;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      elements: this.elements
    };
  }

  snapshot(): RegularLayerSnapshot {
    return {
      ...super.snapshot(),
      reference: this.reference
    };
  }
}
