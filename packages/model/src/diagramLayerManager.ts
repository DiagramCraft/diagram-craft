import { DiagramElement } from './diagramElement';
import type { Diagram } from './diagram';
import { CRDTMap } from './collaboration/crdt';
import { LayersSnapshot, UnitOfWork, UOWTrackable } from './unitOfWork';
import type { Layer, LayerCRDT } from './diagramLayer';
import { type CRDTMapper } from './collaboration/datatypes/mapped/types';
import { RuleLayer } from './diagramLayerRule';
import { ReferenceLayer } from './diagramLayerReference';
import { assert, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import {
  MappedCRDTOrderedMap,
  MappedCRDTOrderedMapMapType
} from './collaboration/datatypes/mapped/mappedCrdtOrderedMap';
import { AttachmentConsumer } from './attachment';
import { RegularLayer } from './diagramLayerRegular';
import { DiagramNode } from './diagramNode';
import { DiagramEdge } from './diagramEdge';
import { watch } from '@diagram-craft/utils/watchableValue';

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
        default:
          return VERIFY_NOT_REACHED();
      }
    },

    toCRDT(e: Layer): CRDTMap<LayerCRDT> {
      return e.crdt;
    }
  };
};

export class LayerManager implements UOWTrackable<LayersSnapshot>, AttachmentConsumer {
  readonly id = 'layers';
  readonly trackableType = 'layerManager';

  // Shared properties
  readonly #layers: MappedCRDTOrderedMap<Layer, LayerCRDT>;
  readonly #visibleLayers: CRDTMap<Record<string, boolean>>;

  // Unshared properties
  #activeLayer: Layer | undefined;

  constructor(
    readonly diagram: Diagram,
    protected readonly crdt: CRDTMap<LayerManagerCRDT>
  ) {
    this.#layers = new MappedCRDTOrderedMap(
      watch(crdt.get('layers', () => diagram.document.root.factory.makeMap())!),
      makeLayerMapper(diagram)
    );

    this.#activeLayer = undefined;

    this.#visibleLayers = crdt.get('visibleLayers', () => diagram.document.root.factory.makeMap())!;

    this.diagram.selectionState.on('add', () => {
      const firstRegularLayer = this.diagram.selectionState.elements
        .map(e => e.layer)
        .filter(e => e.type === 'regular')[0];
      if (!this.diagram.selectionState.isEmpty() && !!firstRegularLayer) {
        this.active = firstRegularLayer;
      }
    });
    this.diagram.selectionState.on('remove', () => {
      const firstRegularLayer = this.diagram.selectionState.elements
        .map(e => e.layer)
        .filter(e => e.type === 'regular')[0];
      if (!this.diagram.selectionState.isEmpty() && !!firstRegularLayer) {
        this.active = firstRegularLayer;
      }
    });
  }

  isAbove(a: DiagramElement, b: DiagramElement) {
    const l1 = this.#layers.values.indexOf(a.layer);
    const l2 = this.#layers.values.indexOf(b.layer);

    if (l1 === l2 && a.layer instanceof RegularLayer && b.layer instanceof RegularLayer) {
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
    uow.snapshot(this);

    const toIndex = this.#layers.getIndex(ref.layer.id);
    let newIdx = ref.relation === 'below' ? toIndex : toIndex + 1;

    for (const layer of layers) {
      this.#layers.setIndex(layer.id, newIdx);
      newIdx += ref.relation === 'below' ? 1 : -1;
    }

    uow.updateElement(this);
  }

  toggleVisibility(layer: Layer) {
    this.#visibleLayers.has(layer.id)
      ? this.#visibleLayers.delete(layer.id)
      : this.#visibleLayers.set(layer.id, true);

    this.diagram.emit('change', { diagram: this.diagram });
  }

  set active(layer: Layer) {
    if (this.#activeLayer === layer) return;
    this.#activeLayer = layer;
    this.diagram.emit('change', { diagram: this.diagram });
  }

  get active() {
    if (!this.#activeLayer) {
      this.#activeLayer = this.visible[0];
    }
    assert.present(this.#activeLayer);
    return this.#activeLayer!;
  }

  byId(id: string) {
    return this.#layers.get(id);
  }

  add(layer: Layer, uow: UnitOfWork) {
    uow.snapshot(this);
    this.#layers.add(layer.id, layer);
    this.#visibleLayers.set(layer.id, true);
    this.#activeLayer = layer;
    uow.updateElement(this);
  }

  remove(layer: Layer, uow: UnitOfWork) {
    uow.snapshot(this);
    this.#layers.remove(layer.id);
    this.#visibleLayers.delete(layer.id);
    if (this.diagram.selectionState.nodes.some(e => e.layer === layer)) {
      this.diagram.selectionState.clear();
    }
    uow.updateElement(this);
  }

  invalidate(_uow: UnitOfWork) {
    // Nothing for now...
  }

  clearCache() {
    // Need to handle all referenced layers separately as the edgeLookup and nodeLookup
    // won't contain these elements
    for (const l of this.all) {
      if (l.type === 'reference') {
        const resolved = l.resolve();
        if (resolved?.type === 'regular') {
          for (const e of (resolved as RegularLayer).elements) {
            if (e instanceof DiagramNode || e instanceof DiagramEdge) {
              e.cache.clear();
            }
          }
        }
      }
    }
  }

  snapshot(): LayersSnapshot {
    return {
      _snapshotType: 'layers',
      layers: this.all.map(l => l.id)
    };
  }

  restore(snapshot: LayersSnapshot, uow: UnitOfWork) {
    for (const [id] of this.#layers.entries) {
      if (!snapshot.layers.includes(id)) {
        this.remove(this.#layers.get(id)!, uow);
      }
    }
    uow.updateElement(this);
  }

  toJSON() {
    return {
      layers: this.#layers,
      activeLayers: this.#activeLayer,
      visibleLayers: this.#visibleLayers.values()
    };
  }

  // TODO: Doesn't this always return an empty array?
  getAttachmentsInUse() {
    return this.#layers.values.flatMap(e => e.getAttachmentsInUse());
  }
}
