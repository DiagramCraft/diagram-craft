import { Layer } from './diagramLayer';
import type { LayerCRDT } from './diagramLayer';
import type { Diagram } from './diagram';
import { UnitOfWork } from './unitOfWork';
import { RuleLayer } from './diagramLayerRule';
import { CRDTMap } from '@diagram-craft/collaboration/crdt';
import { RegularLayer } from './diagramLayerRegular';
import { LayerSnapshot } from '@diagram-craft/model/diagramLayer.uow';

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
  #cache: T | undefined;

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

  resolve(): T | undefined {
    if (!this.#cache) {
      this.#cache = this.diagram.document
        .byId(this.reference.diagramId)
        ?.layers.byId(this.reference.layerId) as T | undefined;
    }
    return this.#cache;
  }

  restore(snapshot: RegularLayerSnapshot, uow: UnitOfWork) {
    super.restore(snapshot, uow);
    this.#reference = snapshot.reference;
  }

  snapshot(): RegularLayerSnapshot {
    return {
      ...super.snapshot(),
      reference: this.reference
    };
  }
}
