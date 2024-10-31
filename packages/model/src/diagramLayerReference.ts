import { Layer, RegularLayer } from './diagramLayer';
import { Diagram } from './diagram';
import { LayerSnapshot, UnitOfWork } from './unitOfWork';
import { RuleLayer } from './diagramLayerRule';

type LayerReference = {
  layerId: string;
  diagramId: string;
};

type RegularLayerSnapshot = LayerSnapshot & {
  reference: LayerReference;
};

export class ReferenceLayer<
  T extends RegularLayer | RuleLayer = RegularLayer | RuleLayer
> extends Layer<T> {
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

  referenceName() {
    const l = this.resolve()!;
    return `${l.diagram.name} / ${l.name}`;
  }

  // TODO: Do we need to cache this
  resolve(): T | undefined {
    const layer = this.diagram.document
      .getById(this.reference.diagramId)
      ?.layers.byId(this.reference.layerId);
    return layer as unknown as T;
  }

  restore(snapshot: RegularLayerSnapshot, uow: UnitOfWork) {
    super.restore(snapshot, uow);
    this.#reference = snapshot.reference;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      reference: this.reference
    };
  }

  snapshot(): RegularLayerSnapshot {
    return {
      ...super.snapshot(),
      reference: this.reference
    };
  }
}
