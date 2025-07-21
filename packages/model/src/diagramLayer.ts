import type { DiagramElement, DiagramElementCRDT } from './diagramElement';
import type { LayerSnapshot, UnitOfWork, UOWTrackable } from './unitOfWork';
import type { Diagram } from './diagram';
import { AttachmentConsumer } from './attachment';
import type { RuleLayer } from './diagramLayerRule';
import { assert } from '@diagram-craft/utils/assert';
import type { ReferenceLayer } from './diagramLayerReference';
import { CRDTList, CRDTMap } from './collaboration/crdt';
import type { RegularLayer } from './diagramLayerRegular';
import type { AdjustmentRule } from './diagramLayerRuleTypes';
import type { MappedCRDTOrderedMapMapType } from './collaboration/datatypes/mapped/mappedCrdtOrderedMap';
import { watch } from '@diagram-craft/utils/watchableValue';
import { CRDTProp } from './collaboration/datatypes/crdtProp';

export type LayerType = 'regular' | 'rule' | 'reference';
export type StackPosition = { element: DiagramElement; idx: number };

export function isReferenceLayer(l: Layer): l is ReferenceLayer {
  return l.type === 'reference';
}

export abstract class Layer<T extends RegularLayer | RuleLayer = RegularLayer | RuleLayer>
  implements UOWTrackable<LayerSnapshot>, AttachmentConsumer
{
  #locked = false;
  #id: CRDTProp<LayerCRDT, 'id'>;
  #name: CRDTProp<LayerCRDT, 'name'>;
  protected _type: LayerType = 'regular';

  readonly diagram: Diagram;

  readonly crdt: CRDTMap<LayerCRDT>;
  readonly trackableType = 'layer';

  protected constructor(
    id: string,
    name: string,
    diagram: Diagram,
    type?: LayerType,
    crdt?: CRDTMap<LayerCRDT>
  ) {
    this.crdt = crdt ?? diagram.document.root.factory.makeMap();
    this.crdt.set('id', id);
    this.crdt.set('name', name);

    this._type = type ?? 'regular';
    this.crdt.set('type', this._type);

    this.#name = new CRDTProp(watch(this.crdt), 'name', {
      onRemoteChange: () => {
        this.diagram.emit('change', { diagram: this.diagram });
      }
    });
    this.#id = new CRDTProp(watch(this.crdt), 'id');

    this.diagram = diagram;
  }

  get type() {
    return this._type;
  }

  get id() {
    return this.#id.get()!;
  }

  get name() {
    return this.#name.get()!;
  }

  setName(name: string, uow: UnitOfWork) {
    uow.snapshot(this);
    this.#name.set(name);
    uow.updateElement(this);
  }

  isLocked() {
    return this.#locked;
  }

  // TODO: Add uow here
  set locked(value: boolean) {
    this.#locked = value;
    this.diagram.emit('change', { diagram: this.diagram });
  }

  abstract resolve(): T | undefined;

  resolveForced(): T {
    const r = this.resolve();
    assert.present(r);
    return r;
  }

  getInboundReferences() {
    const inboundReferences: ReferenceLayer[] = [];
    const doc = this.diagram.document;
    for (const d of doc.diagramIterator({ nest: true })) {
      for (const l of d.layers.all) {
        if (isReferenceLayer(l)) {
          const ref = l.reference;
          if (ref.diagramId === this.diagram.id && ref.layerId === this.id) {
            inboundReferences.push(l);
          }
        }
      }
    }
    return inboundReferences;
  }

  /* Snapshot ************************************************************************************************ */

  toJSON() {
    return {
      name: this.name,
      locked: this.isLocked(),
      type: this.type
    };
  }

  snapshot(): LayerSnapshot {
    return {
      _snapshotType: 'layer',
      name: this.name,
      locked: this.isLocked(),
      // TODO: Remove elements from here
      elements: [],
      type: this.type
    };
  }

  restore(snapshot: LayerSnapshot, uow: UnitOfWork) {
    this.setName(snapshot.name, uow);
    this.locked = snapshot.locked;
    this._type = snapshot.type;
    uow.updateElement(this);
  }

  isAbove(layer: Layer) {
    return this.diagram.layers.all.indexOf(this) < this.diagram.layers.all.indexOf(layer);
  }

  invalidate(_uow: UnitOfWork) {
    // Nothing for now...
  }

  getAttachmentsInUse(): string[] {
    return [];
  }
}

export type LayerCRDT = {
  id: string;
  name: string;
  type: LayerType;

  // Reference layer
  referenceLayerId: string;
  referenceDiagramId: string;

  // Regular layer
  elements: CRDTMap<MappedCRDTOrderedMapMapType<DiagramElementCRDT>>;

  // Rule layer
  rules: CRDTList<AdjustmentRule>;
};
