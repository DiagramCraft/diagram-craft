import { type DiagramElementCRDT } from './diagramElement';
import type { UnitOfWork, UOWTrackable } from './unitOfWork';
import type { Diagram } from './diagram';
import { AttachmentConsumer } from './attachment';
import type { RuleLayer } from './diagramLayerRule';
import { assert } from '@diagram-craft/utils/assert';
import type { ReferenceLayer } from './diagramLayerReference';
import type { RegularLayer } from './diagramLayerRegular';
import type { AdjustmentRule } from './diagramLayerRuleTypes';
import { WatchableValue, watch } from '@diagram-craft/utils/watchableValue';
import type { ModificationCRDT, ModificationLayer } from './diagramLayerModification';
import { CRDTProp } from '@diagram-craft/collaboration/datatypes/crdtProp';
import type { CRDTList, CRDTMap } from '@diagram-craft/collaboration/crdt';
import type { MappedCRDTOrderedMapMapType } from '@diagram-craft/collaboration/datatypes/mapped/mappedCrdtOrderedMap';
import { type Releasable, Releasables } from '@diagram-craft/utils/releasable';
import { isRegularLayer } from './diagramLayerUtils';
import { UOWRegistry } from '@diagram-craft/model/unitOfWork';
import {
  LayerChildUOWAdapter,
  LayerSnapshot,
  LayerUOWAdapter
} from '@diagram-craft/model/diagramLayer.uow';
import { Detachable } from './detachable';

export type LayerType = 'regular' | 'rule' | 'reference' | 'modification';

type LayerAttachParent = {
  _trackableType: 'layerManager';
};

export function isReferenceLayer(l: Layer): l is ReferenceLayer {
  return l.type === 'reference';
}

export abstract class Layer<
  T extends RegularLayer | RuleLayer | ModificationLayer =
    | RegularLayer
    | RuleLayer
    | ModificationLayer
> implements UOWTrackable, AttachmentConsumer, Releasable, Detachable<LayerAttachParent>
{
  #locked = false;
  #id: CRDTProp<LayerCRDT, 'id'>;
  #name: CRDTProp<LayerCRDT, 'name'>;
  protected _type: LayerType = 'regular';
  _isAttached = false;

  readonly diagram: Diagram;
  protected readonly _releasables = new Releasables();

  readonly _crdt: WatchableValue<CRDTMap<LayerCRDT>>;
  readonly _trackableType = 'layer';

  protected constructor(
    id: string,
    name: string,
    diagram: Diagram,
    type?: LayerType,
    crdt?: CRDTMap<LayerCRDT>
  ) {
    this._crdt = watch(crdt ?? diagram.document.root.factory.makeMap());
    const current = this._crdt.get();
    current.set('id', id);
    current.set('name', name);

    this._type = type ?? 'regular';
    current.set('type', this._type);

    this.#name = new CRDTProp(this._crdt, 'name', {
      onRemoteChange: () => {
        diagram.layers.emit('layerUpdated', { layer: this });
      }
    });
    this.#id = new CRDTProp(this._crdt, 'id');

    this.diagram = diagram;
  }

  get crdt() {
    return this._crdt.get();
  }

  release() {
    this._releasables.release();
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

  get locked() {
    return this.#locked;
  }

  setName(name: string, uow: UnitOfWork) {
    uow.executeUpdate(this, () => this.#name.set(name));
  }

  isEffectivelyLocked() {
    return this.locked || this.diagram.isEffectivelyLocked();
  }

  setLocked(value: boolean, uow: UnitOfWork) {
    uow.executeUpdate(this, () => {
      this.#locked = value;
      this.diagram.layers.emit('layerStructureChange');
    });
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

  snapshot(): LayerSnapshot {
    return {
      _snapshotType: 'layer',
      name: this.name,
      locked: this.locked,
      type: this.type
    };
  }

  restore(snapshot: LayerSnapshot, uow: UnitOfWork) {
    this.setName(snapshot.name, uow);
    this.setLocked(snapshot.locked, uow);
    this._type = snapshot.type;
    uow.updateElement(this);
  }

  isAbove(layer: Layer) {
    return this.diagram.layers.all.indexOf(this) < this.diagram.layers.all.indexOf(layer);
  }

  getAttachmentsInUse(): string[] {
    return [];
  }

  protected watchCrdtField<T>(getter: (crdt: CRDTMap<LayerCRDT>) => T): WatchableValue<T> {
    return WatchableValue.from(([crdt]) => getter(crdt.get()), [this._crdt]);
  }

  protected _onAttach(_uow: UnitOfWork): void {}

  protected _onDetach(_uow: UnitOfWork): void {}

  _detach(callback: () => void, uow: UnitOfWork): void {
    assert.true(this._isAttached);

    const clone = this._crdt.get().clone();
    this._onDetach(uow);
    callback();
    this._crdt.set(clone);
    this._isAttached = false;
  }

  _attach(_parent: LayerAttachParent, uow: UnitOfWork): void {
    assert.true(uow.isRemote || !this._isAttached);

    this._isAttached = true;
    this._onAttach(uow);
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

  // Modification layer
  modifications: CRDTMap<MappedCRDTOrderedMapMapType<ModificationCRDT>>;
};

declare global {
  namespace DiagramCraft {
    interface AssertTypeExtensions {
      isRegularLayer: (e: Layer) => asserts e is RegularLayer;
    }
  }
}

assert.isRegularLayer = (e: Layer): asserts e is RegularLayer =>
  assert.true(isRegularLayer(e), 'not regular layer');

UOWRegistry.adapters['layer'] = new LayerUOWAdapter();
UOWRegistry.childAdapters['layer-element'] = new LayerChildUOWAdapter();
