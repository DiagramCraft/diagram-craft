import { Layer } from './diagramLayer';
import type { LayerCRDT } from './diagramLayer';
import type { Diagram } from './diagram';
import { LayerSnapshot, UnitOfWork } from './unitOfWork';
import { RuleLayer } from './diagramLayerRule';
import { CRDTMap } from './collaboration/crdt';
import { RegularLayer } from './diagramLayerRegular';

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

  constructor(
    id: string,
    name: string,
    diagram: Diagram,
    reference: LayerReference,
    crdt?: CRDTMap<LayerCRDT>
  ) {
    super(id, name, diagram, 'reference', crdt);
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
      .byId(this.reference.diagramId)
      ?.layers.byId(this.reference.layerId);
    return layer as unknown as T;
  }

  restore(snapshot: RegularLayerSnapshot, uow: UnitOfWork) {
    super.restore(snapshot, uow);
    this.#reference = snapshot.reference;
  }

  /*
  TODO: Is this really needed
  toJSON() {
    return {
      ...super.toJSON(),
      reference: this.reference
    };
  }
   */

  snapshot(): RegularLayerSnapshot {
    return {
      ...super.snapshot(),
      reference: this.reference
    };
  }
}
