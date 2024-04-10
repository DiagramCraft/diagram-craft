import { DiagramNode } from './diagramNode';
import { DiagramElement, isNode } from './diagramElement';
import { LayerSnapshot, LayersSnapshot, UnitOfWork, UOWTrackable } from './unitOfWork';
import { DiagramEdge } from './diagramEdge';
import { Diagram, StackPosition } from './diagram';
import { groupBy } from '@diagram-craft/utils/array';

export type LayerType = 'layer' | 'adjustment';

export class Layer implements UOWTrackable<LayerSnapshot> {
  #elements: Array<DiagramElement> = [];
  #locked = false;
  #name: string;
  #type: LayerType = 'layer';

  readonly #diagram: Diagram;

  constructor(
    public readonly id: string,
    name: string,
    elements: ReadonlyArray<DiagramElement>,
    diagram: Diagram,
    type?: LayerType
  ) {
    this.#name = name;
    this.#diagram = diagram;
    this.#type = type ?? 'layer';

    const uow = new UnitOfWork(diagram);
    elements.forEach(e => this.addElement(e, uow));
    uow.abort();
  }

  get type() {
    return this.#type;
  }

  get name() {
    return this.#name;
  }

  setName(name: string, uow: UnitOfWork) {
    uow.snapshot(this);
    this.#name = name;
    uow.updateElement(this);
  }

  get elements(): ReadonlyArray<DiagramElement> {
    return this.#elements;
  }

  isLocked() {
    return this.#locked;
  }

  // TODO: Add uow here
  set locked(value: boolean) {
    this.#locked = value;
    this.#diagram.emit('change', { diagram: this.#diagram });
  }

  /* Snapshot ************************************************************************************************ */

  toJSON() {
    return {
      name: this.name,
      locked: this.isLocked(),
      elements: this.elements,
      type: this.type
    };
  }

  snapshot(): LayerSnapshot {
    return {
      _snapshotType: 'layer',
      name: this.name,
      locked: this.isLocked(),
      elements: this.elements.map(e => e.id),
      type: this.type
    };
  }

  restore(snapshot: LayerSnapshot, uow: UnitOfWork) {
    this.setElements(
      snapshot.elements.map(id => this.#diagram.lookup(id)!),
      uow
    );
    this.setName(snapshot.name, uow);
    this.locked = snapshot.locked;
    this.#type = snapshot.type;
    uow.updateElement(this);
  }

  // TODO: Add some tests for the stack operations
  stackModify(elements: ReadonlyArray<DiagramElement>, positionDelta: number, uow: UnitOfWork) {
    uow.snapshot(this);

    const byParent = groupBy(elements, e => e.parent);

    const snapshot = new Map<DiagramNode | undefined, StackPosition[]>();
    const newPositions = new Map<DiagramNode | undefined, StackPosition[]>();

    for (const [parent, elements] of byParent) {
      const existing = parent?.children ?? this.elements;

      const oldStackPositions = existing.map((e, i) => ({ element: e, idx: i }));
      snapshot.set(parent, oldStackPositions);

      const newStackPositions = existing.map((e, i) => ({ element: e, idx: i }));
      for (const p of newStackPositions) {
        if (!elements.includes(p.element)) continue;
        p.idx += positionDelta;
      }
      newPositions.set(parent, newStackPositions);
    }

    this.stackSet(newPositions, uow);

    return snapshot;
  }

  stackSet(newPositions: Map<DiagramNode | undefined, StackPosition[]>, uow: UnitOfWork) {
    uow.snapshot(this);

    for (const [parent, positions] of newPositions) {
      positions.sort((a, b) => a.idx - b.idx);
      if (parent) {
        parent.setChildren(
          positions.map(e => e.element),
          uow
        );
      } else {
        this.#elements = positions.map(e => e.element);
      }
    }

    uow.updateElement(this);
  }

  addElement(element: DiagramElement, uow: UnitOfWork) {
    uow.snapshot(this);

    if (!element.parent && !this.#elements.includes(element)) this.#elements.push(element);
    this.processElementForAdd(element);
    uow.addElement(element);
    uow.updateElement(this);
  }

  removeElement(element: DiagramElement, uow: UnitOfWork) {
    uow.snapshot(this);

    this.#elements = this.elements.filter(e => e !== element);
    element.detach(uow);
    uow.removeElement(element);
    uow.updateElement(this);
  }

  setElements(elements: ReadonlyArray<DiagramElement>, uow: UnitOfWork) {
    uow.snapshot(this);

    const added = elements.filter(e => !this.#elements.includes(e));
    const removed = this.#elements.filter(e => !elements.includes(e));
    this.#elements = elements as Array<DiagramElement>;
    for (const e of added) {
      this.processElementForAdd(e);
      uow.addElement(e);
    }
    for (const e of removed) {
      uow.removeElement(e);
    }

    uow.updateElement(this);
  }

  isAbove(layer: Layer) {
    return this.#diagram.layers.all.indexOf(this) < this.#diagram.layers.all.indexOf(layer);
  }

  invalidate(_uow: UnitOfWork) {
    // Nothing for now...
  }

  private processElementForAdd(e: DiagramElement) {
    e._setLayer(this, this.#diagram);
    if (isNode(e)) {
      this.#diagram.nodeLookup.set(e.id, e);
      for (const child of e.children) {
        this.processElementForAdd(child);
      }
    } else {
      this.#diagram.edgeLookup.set(e.id, e as DiagramEdge);
    }
  }
}

export class LayerManager implements UOWTrackable<LayersSnapshot> {
  id = 'layers';
  #layers: Array<Layer> = [];
  #activeLayer: Layer;
  #visibleLayers = new Set<string>();

  constructor(
    readonly diagram: Diagram,
    layers: Array<Layer>
  ) {
    this.#layers = layers;
    this.#activeLayer = layers[0];

    this.#layers.forEach(layer => {
      this.#visibleLayers.add(layer.id);
    });

    this.diagram.selectionState.on('add', () => {
      if (!this.diagram.selectionState.isEmpty() && this.active.type === 'layer') {
        this.active = this.diagram.selectionState.elements[0].layer;
      }
    });
    this.diagram.selectionState.on('remove', () => {
      if (!this.diagram.selectionState.isEmpty() && this.active.type === 'layer') {
        this.active = this.diagram.selectionState.elements[0].layer;
      }
    });
  }

  get all(): ReadonlyArray<Layer> {
    return this.#layers;
  }

  get visible(): ReadonlyArray<Layer> {
    return this.#layers.filter(layer => this.#visibleLayers.has(layer.id));
  }

  move(
    layers: ReadonlyArray<Layer>,
    uow: UnitOfWork,
    ref: { layer: Layer; relation: 'above' | 'below' }
  ) {
    uow.snapshot(this);

    const idx = this.#layers.indexOf(ref.layer);
    const newIdx = ref.relation === 'below' ? idx : idx + 1;

    for (const layer of layers) {
      const oldIdx = this.#layers.indexOf(layer);
      this.#layers.splice(oldIdx, 1);
      this.#layers.splice(newIdx, 0, layer);
    }

    uow.updateElement(this);
  }

  toggleVisibility(layer: Layer) {
    this.#visibleLayers.has(layer.id)
      ? this.#visibleLayers.delete(layer.id)
      : this.#visibleLayers.add(layer.id);
    this.diagram.emit('change', { diagram: this.diagram });
  }

  set active(layer: Layer) {
    if (this.#activeLayer === layer) return;
    this.#activeLayer = layer;
    this.diagram.emit('change', { diagram: this.diagram });
  }

  get active() {
    return this.#activeLayer;
  }

  byId(id: string) {
    return this.#layers.find(l => l.id === id);
  }

  add(layer: Layer, uow: UnitOfWork) {
    uow.snapshot(this);
    this.#layers.push(layer);
    this.#visibleLayers.add(layer.id);
    this.#activeLayer = layer;
    uow.updateElement(this);
  }

  remove(layer: Layer, uow: UnitOfWork) {
    uow.snapshot(this);
    this.#layers = this.#layers.filter(l => l !== layer);
    this.#visibleLayers.delete(layer.id);
    if (this.diagram.selectionState.nodes.some(e => e.layer === layer)) {
      this.diagram.selectionState.clear();
    }
    uow.updateElement(this);
  }

  invalidate(_uow: UnitOfWork) {
    // Nothing for now...
  }

  snapshot(): LayersSnapshot {
    return {
      _snapshotType: 'layers',
      layers: this.all.map(l => l.id)
    };
  }

  restore(snapshot: LayersSnapshot, uow: UnitOfWork) {
    this.#layers = snapshot.layers.map(id => this.diagram.layers.byId(id)!);
    uow.updateElement(this);
  }

  toJSON() {
    return {
      layers: this.#layers,
      activeLayers: this.#activeLayer,
      visibleLayers: this.#visibleLayers
    };
  }
}
