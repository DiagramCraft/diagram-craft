import { DiagramElement } from './diagramElement';
import type { Diagram } from './diagram';
import { LayersSnapshot, UnitOfWork, UOWTrackable } from './unitOfWork';
import type { Layer, LayerCRDT } from './diagramLayer';
import { RuleLayer } from './diagramLayerRule';
import { ReferenceLayer } from './diagramLayerReference';
import { assert, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { AttachmentConsumer } from './attachment';
import { RegularLayer } from './diagramLayerRegular';
import { watch } from '@diagram-craft/utils/watchableValue';
import { EventEmitter } from '@diagram-craft/utils/event';
import { ModificationLayer } from './diagramLayerModification';
import type { EmptyObject } from '@diagram-craft/utils/types';
import type { CRDTMap } from '@diagram-craft/collaboration/crdt';
import {
  MappedCRDTOrderedMap,
  type MappedCRDTOrderedMapMapType
} from '@diagram-craft/collaboration/datatypes/mapped/mappedCrdtOrderedMap';
import type { CRDTMapper } from '@diagram-craft/collaboration/datatypes/mapped/types';
import { type Releasable, Releasables } from '@diagram-craft/utils/releasable';
import { UnitOfWorkManager } from '@diagram-craft/model/unitOfWorkManager';
import {
  LayerManagerParentChildUOWSpecification,
  LayerManagerUOWSpecification
} from '@diagram-craft/model/diagramLayerManager.uow';

export type LayerManagerCRDT = {
  // TODO: Should we move visibility to be a property of the layer instead
  visibleLayers: CRDTMap<Record<string, boolean>>;
  layers: CRDTMap<MappedCRDTOrderedMapMapType<LayerCRDT>>;
};

export const makeLayerMapper = (diagram: Diagram): CRDTMapper<Layer, CRDTMap<LayerCRDT>> => {
  return {
    fromCRDT(e: CRDTMap<LayerCRDT>): Layer {
      const type = e.get('type')!;
      const id = e.get('id')!;
      const name = e.get('name')!;

      switch (type) {
        case 'regular':
          return new RegularLayer(id, name, [], diagram, e);
        case 'rule':
          return new RuleLayer(id, name, diagram, [], e);
        case 'reference':
          return new ReferenceLayer(
            id,
            name,
            diagram,
            {
              layerId: e.get('referenceLayerId')!,
              diagramId: e.get('referenceDiagramId')!
            },
            e
          );
        case 'modification':
          return new ModificationLayer(id, name, diagram, [], e);

        default:
          return VERIFY_NOT_REACHED();
      }
    },

    toCRDT(e: Layer): CRDTMap<LayerCRDT> {
      return e.crdt;
    }
  };
};

export type LayerManagerEvents = {
  layerAdded: { layer: Layer };
  layerUpdated: { layer: Layer };
  layerRemoved: { layer: Layer };
  layerStructureChange: EmptyObject;
};

export class LayerManager
  extends EventEmitter<LayerManagerEvents>
  implements UOWTrackable, AttachmentConsumer, Releasable
{
  readonly id = 'layers';
  readonly trackableType = 'layerManager';

  // Shared properties
  readonly #layers: MappedCRDTOrderedMap<Layer, LayerCRDT>;
  readonly #visibleLayers: CRDTMap<Record<string, boolean>>;

  // Unshared properties
  #activeLayer: Layer | undefined;
  readonly #releasables = new Releasables();

  constructor(
    readonly diagram: Diagram,
    protected readonly crdt: CRDTMap<LayerManagerCRDT>
  ) {
    super();
    this.#layers = new MappedCRDTOrderedMap(
      watch(crdt.get('layers', () => diagram.document.root.factory.makeMap())!),
      makeLayerMapper(diagram),
      {
        onRemoteAdd: layer => this.emit('layerAdded', { layer }),
        onRemoteRemove: layer => this.emit('layerRemoved', { layer }),
        onRemoteChange: layer => this.emit('layerUpdated', { layer })
      }
    );

    this.#activeLayer = undefined;

    this.#visibleLayers = crdt.get('visibleLayers', () => diagram.document.root.factory.makeMap())!;
    this.#releasables.add(
      this.#visibleLayers.on('remoteUpdate', () => this.emit('layerStructureChange', {}))
    );
    this.#releasables.add(
      this.#visibleLayers.on('remoteInsert', () => this.emit('layerStructureChange', {}))
    );
    this.#releasables.add(
      this.#visibleLayers.on('remoteDelete', () => this.emit('layerStructureChange', {}))
    );

    this.#releasables.add(
      this.diagram.selection.on('add', () => {
        // We don't want to change active layer in case we are in a modification layer, as
        // this prevents the ability to manage the modification layer
        if (this.active.type === 'modification') return;

        const firstRegularLayer = this.diagram.selection.elements
          .map(e => e.layer)
          .filter(e => e.type === 'regular')[0];
        if (!this.diagram.selection.isEmpty() && !!firstRegularLayer) {
          this.active = firstRegularLayer;
        }
      })
    );
    this.#releasables.add(
      this.diagram.selection.on('remove', () => {
        // We don't want to change active layer in case we are in a modification layer, as
        // this prevents the ability to manage the modification layer
        if (this.active.type === 'modification') return;

        const firstRegularLayer = this.diagram.selection.elements
          .map(e => e.layer)
          .filter(e => e.type === 'regular')[0];
        if (!this.diagram.selection.isEmpty() && !!firstRegularLayer) {
          this.active = firstRegularLayer;
        }
      })
    );
  }

  release(): void {
    this.#releasables.release();
  }

  isAbove(a: DiagramElement, b: DiagramElement) {
    const l1 = this.#layers.values.indexOf(a.layer);
    const l2 = this.#layers.values.indexOf(b.layer);

    if (l1 === l2) {
      return a.layer.elements.indexOf(a) > b.layer.elements.indexOf(b);
    }

    return l1 > l2;
  }

  get all(): ReadonlyArray<Layer> {
    return this.#layers.values;
  }

  get visible(): ReadonlyArray<Layer> {
    return this.#layers.values.filter(layer => this.#visibleLayers.get(layer.id) === true);
  }

  move(
    layers: ReadonlyArray<Layer>,
    uow: UnitOfWork,
    ref: { layer: Layer; relation: 'above' | 'below' }
  ) {
    uow.executeUpdate(this, () => {
      // Build new order
      const currentOrder = this.#layers.keys;
      const layerIds = new Set(layers.map(l => l.id));

      // Remove the layers being moved from their current positions
      const remainingLayers = currentOrder.filter(id => !layerIds.has(id));

      // Find the reference layer's position in the remaining layers
      const refIndexInRemaining = remainingLayers.indexOf(ref.layer.id);

      // Insert the moved layers at the correct position
      // 'below' means earlier in render order (lower index)
      // 'above' means later in render order (higher index)
      const insertIndex = ref.relation === 'below' ? refIndexInRemaining : refIndexInRemaining + 1;
      const newOrder = [
        ...remainingLayers.slice(0, insertIndex),
        ...layers.map(l => l.id),
        ...remainingLayers.slice(insertIndex)
      ];

      // Apply the new order
      this.#layers.setOrder(newOrder);
    });
  }

  toggleVisibility(layer: Layer) {
    if (this.#visibleLayers.has(layer.id)) {
      this.#visibleLayers.delete(layer.id);
    } else {
      this.#visibleLayers.set(layer.id, true);
    }

    this.diagram.selection.filterSelectionToVisibleElements();

    this.emit('layerStructureChange', {});
  }

  set active(layer: Layer) {
    if (this.#activeLayer === layer) return;
    this.#activeLayer = layer;

    this.emit('layerStructureChange', {});
  }

  get active() {
    if (!this.#activeLayer) {
      this.#activeLayer = this.visible[0];
    }
    assert.present(this.#activeLayer);
    return this.#activeLayer;
  }

  byId(id: string) {
    return this.#layers.get(id);
  }

  add(layer: Layer, uow: UnitOfWork) {
    uow.executeAdd(layer, this, this.#layers.size, () => {
      this.#layers.add(layer.id, layer);
      this.#visibleLayers.set(layer.id, true);
      this.#activeLayer = layer;
    });
  }

  remove(layer: Layer, uow: UnitOfWork) {
    uow.executeRemove(layer, this, this.#layers.size, () => {
      this.#layers.remove(layer.id);
      this.#visibleLayers.delete(layer.id);
      if (this.diagram.selection.nodes.some(e => e.layer === layer)) {
        this.diagram.selection.clear();
      }
    });
  }

  invalidate(_uow: UnitOfWork) {
    // Nothing for now...
  }

  _snapshot(): LayersSnapshot {
    return {
      _snapshotType: 'layers',
      layers: this.all.map(l => l.id)
    };
  }

  _restore(snapshot: LayersSnapshot, uow: UnitOfWork) {
    // TODO: This implementation is a bit weird
    for (const [id] of this.#layers.entries) {
      if (!snapshot.layers.includes(id)) {
        this.remove(this.#layers.get(id)!, uow);
      }
    }
    this.#layers.setOrder(snapshot.layers);
    uow.updateElement(this);
  }

  // TODO: Doesn't this always return an empty array?
  getAttachmentsInUse() {
    return this.#layers.values.flatMap(e => e.getAttachmentsInUse());
  }
}

/** @namespace */
export const LayerCapabilities = {
  canMove(layer: Layer): boolean {
    return layer.type === 'modification' || layer.type === 'regular';
  }
};

UnitOfWorkManager.trackableSpecs['layerManager'] = new LayerManagerUOWSpecification();
UnitOfWorkManager.parentChildSpecs['layerManager-layer'] =
  new LayerManagerParentChildUOWSpecification();
