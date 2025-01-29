import { Viewbox } from './viewBox';
import { DiagramNode } from './diagramNode';
import { DiagramEdge } from './diagramEdge';
import { assertRegularLayer, Layer, LayerManager, RegularLayer } from './diagramLayer';
import { SelectionState } from './selectionState';
import { UndoManager } from './undoManager';
import { SnapManager } from './snap/snapManager';
import { SnapManagerConfig } from './snap/snapManagerConfig';
import { UnitOfWork } from './unitOfWork';
import { DiagramElement, isEdge, isNode } from './diagramElement';
import { DiagramDocument } from './diagramDocument';
import { Box } from '@diagram-craft/geometry/box';
import { Transform } from '@diagram-craft/geometry/transform';
import { EventEmitter, EventKey } from '@diagram-craft/utils/event';
import { assert } from '@diagram-craft/utils/assert';
import { AttachmentConsumer } from './attachment';
import { newid } from '@diagram-craft/utils/id';

export type Canvas = Omit<Box, 'r'>;

export type DiagramEvents = {
  /* Diagram props, canvas have changed, or a large restructure of
   * elements have occurred (e.g. change of stacking order)
   */
  change: { diagram: Diagram };

  /* A single element has changed (e.g. moved, resized, etc) */
  elementChange: { element: DiagramElement; silent?: boolean };

  /* A new element has been added to the diagram */
  elementAdd: { element: DiagramElement };

  /* An element has been removed from the diagram */
  elementRemove: { element: DiagramElement };

  /* An element has highlights changed */
  elementHighlighted: { element: DiagramElement };

  /* A unit of work has been commited - useful for batch operations */
  uowCommit: { removed: DiagramElement[]; added: DiagramElement[]; updated: DiagramElement[] };
};

export class Diagram extends EventEmitter<DiagramEvents> implements AttachmentConsumer {
  #canvas: Canvas = { x: 0, y: 0, w: 640, h: 640 };
  #document: DiagramDocument | undefined;

  diagrams: ReadonlyArray<Diagram> = [];
  mustCalculateIntersections = true;

  readonly props: DiagramProps = {};
  readonly viewBox = new Viewbox(this.#canvas);
  readonly nodeLookup = new Map<string, DiagramNode>();
  readonly edgeLookup = new Map<string, DiagramEdge>();
  readonly selectionState = new SelectionState(this);
  readonly layers = new LayerManager(this, []);
  readonly snapManagerConfig = new SnapManagerConfig([
    'grid',
    'node',
    'canvas',
    'distance',
    'size'
  ]);
  readonly undoManager = new UndoManager(this);

  readonly uid = newid();

  constructor(
    readonly id: string,
    readonly name: string,
    document: DiagramDocument
  ) {
    super();

    this.#document = document;

    // TODO: We should be able to remove this
    const toggleMustCalculateIntersections = () => {
      const old = this.mustCalculateIntersections;
      this.mustCalculateIntersections = this.visibleElements().some(
        e => isEdge(e) && e.renderProps.lineHops.type !== 'none'
      );
      // Only trigger invalidation in case the value has changed to true
      if (this.mustCalculateIntersections && this.mustCalculateIntersections !== old) {
        const uow = new UnitOfWork(this);
        if (this.activeLayer instanceof RegularLayer) {
          this.activeLayer.elements
            .filter(e => isEdge(e))
            .forEach(e => (e as DiagramEdge).invalidate(uow));
        }
        uow.commit();
      }
    };
    this.on('elementChange', toggleMustCalculateIntersections);
    this.on('elementAdd', toggleMustCalculateIntersections);
    this.on('elementRemove', toggleMustCalculateIntersections);
    toggleMustCalculateIntersections();
  }

  emit<K extends EventKey<DiagramEvents>>(eventName: K, params?: DiagramEvents[K]) {
    // This is triggered for instance when a rule layer toggles visibility
    if (eventName === 'change') {
      for (const k of this.edgeLookup.values()) {
        k.cache.clear();
      }
      for (const k of this.nodeLookup.values()) {
        k.cache.clear();
      }

      // Need to handle all referenced layers separately as the edgeLookup and nodeLookup
      // won't contain these elements
      for (const l of this.layers.all) {
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
    super.emit(eventName, params);
  }

  get activeLayer() {
    return this.layers.active;
  }

  set document(d: DiagramDocument) {
    this.#document = d;
  }

  get document(): DiagramDocument {
    return this.#document!;
  }

  *allElementsIterator(): Generator<DiagramElement> {
    yield* Object.values(this.nodeLookup);
    yield* Object.values(this.edgeLookup);
  }

  lookup(id: string): DiagramElement | undefined {
    return this.nodeLookup.get(id) ?? this.edgeLookup.get(id);
  }

  createSnapManager() {
    const selection = this.selectionState.nodes;

    const firstParent = selection[0]?.parent;
    if (firstParent && selection.every(n => n.parent === firstParent)) {
      const selectionIds = new Set(firstParent.children.map(c => c.id));
      for (const n of selection) {
        selectionIds.delete(n.id);
      }

      return new SnapManager(this, id => selectionIds.has(id), this.snapManagerConfig);
    } else {
      const selectionIds = new Set(this.selectionState.elements.map(e => e.id));
      return new SnapManager(
        this,
        id => !selectionIds.has(id) && !this.lookup(id)?.parent,
        this.snapManagerConfig
      );
    }
  }

  visibleElements() {
    return this.layers.visible.flatMap(l => (l instanceof RegularLayer ? l.elements : []));
  }

  get canvas() {
    return this.#canvas;
  }

  set canvas(b: Canvas) {
    this.#canvas = b;
    this.update();
  }

  findChildDiagramById(id: string): Diagram | undefined {
    return (
      this.diagrams.find(d => d.id === id) ??
      this.diagrams.map(d => d.findChildDiagramById(id)).find(d => d !== undefined)
    );
  }

  // TODO: Check layer level events are emitted
  moveElement(
    elements: ReadonlyArray<DiagramElement>,
    uow: UnitOfWork,
    layer: Layer,
    ref?: { relation: 'above' | 'below' | 'on'; element: DiagramElement }
  ) {
    elements.forEach(e => uow.snapshot(e));

    const elementLayers = elements.map(e => {
      assertRegularLayer(e.layer);
      return e.layer;
    });
    const topMostLayer = this.layers.all.findLast(
      layer => layer instanceof RegularLayer && elementLayers.includes(layer)
    );
    assert.present(topMostLayer);

    // Cannot move an element into itself, so abort if this is the case
    if (elements.some(e => e === ref?.element)) return;

    // Remove from existing layers
    const sourceLayers = new Set(elementLayers);
    for (const l of sourceLayers) {
      uow.snapshot(l);
      l.setElements(
        l.elements.filter(e => !elements.includes(e)),
        uow
      );
    }

    // Remove from groups
    // TODO: Can optimize by grouping by parent - probably not worth it
    for (const el of elements) {
      if (el.parent) {
        uow.snapshot(el.parent);
        el.parent.removeChild(el, uow);
      }
    }

    uow.snapshot(layer);

    // Move into the new layer
    if (ref === undefined) {
      assert.true(layer instanceof RegularLayer);
      if (layer.isAbove(topMostLayer)) {
        (layer as RegularLayer).setElements(
          [...(layer as RegularLayer).elements, ...elements],
          uow
        );
      } else {
        (layer as RegularLayer).setElements(
          [...elements, ...(layer as RegularLayer).elements],
          uow
        );
      }
    } else if (isNode(ref.element) && ref.element.parent) {
      const parent = ref.element.parent;
      uow.snapshot(parent);
      uow.snapshot(ref.element);

      const idx = parent.children.indexOf(ref.element);
      if (ref.relation === 'above') {
        parent.setChildren(parent.children.toSpliced(idx + 1, 0, ...elements), uow);
      } else if (ref.relation === 'below') {
        parent.setChildren(parent.children.toSpliced(idx, 0, ...elements), uow);
      } else {
        ref.element.setChildren([...ref.element.children, ...elements], uow);
      }
    } else {
      assert.true(ref.element.layer === layer);
      uow.snapshot(ref.element);

      assert.true(layer instanceof RegularLayer);
      const idx = (layer as RegularLayer).elements.indexOf(ref.element);
      if (ref.relation === 'above') {
        (layer as RegularLayer).setElements(
          (layer as RegularLayer).elements.toSpliced(idx + 1, 0, ...elements),
          uow
        );
      } else if (ref.relation === 'below') {
        (layer as RegularLayer).setElements(
          (layer as RegularLayer).elements.toSpliced(idx, 0, ...elements),
          uow
        );
      } else if (isNode(ref.element)) {
        ref.element.setChildren([...ref.element.children, ...elements], uow);
      }
    }

    // Assign new layer
    assert.true(layer instanceof RegularLayer);
    elements.forEach(e => (layer as RegularLayer).addElement(e, uow));

    // TODO: Not clear if this is needed or not
    uow.updateDiagram();
  }

  transformElements(
    elements: ReadonlyArray<DiagramElement>,
    transforms: ReadonlyArray<Transform>,
    uow: UnitOfWork
  ) {
    for (const el of elements) {
      el.transform(transforms, uow);
    }

    // We do this in a separate loop to as nodes might move which will
    // affect the start and end location of connected edges
    for (const el of elements) {
      uow.updateElement(el);
    }
  }

  // TODO: Remove this
  /** @deprecated */
  update() {
    this.emit('change', { diagram: this });
  }

  toJSON() {
    return {
      diagrams: this.diagrams,
      props: this.props,
      selectionState: this.selectionState,
      id: this.id,
      name: this.name,
      layers: this.layers
    };
  }

  getAttachmentsInUse() {
    return this.layers.getAttachmentsInUse();
  }
}
