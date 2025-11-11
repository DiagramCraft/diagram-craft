import { Viewbox } from './viewBox';
import { DiagramNode } from './diagramNode';
import { DiagramEdge, SimpleDiagramEdge } from './diagramEdge';
import { Selection } from './selection';
import { UndoManager } from './undoManager';
import { UnitOfWork } from './unitOfWork';
import { bindElementListeners, DiagramElement, isEdge, isNode } from './diagramElement';
import type { DiagramDocument } from './diagramDocument';
import { Box } from '@diagram-craft/geometry/box';
import { Extent } from '@diagram-craft/geometry/extent';
import { EventEmitter } from '@diagram-craft/utils/event';
import { assert } from '@diagram-craft/utils/assert';
import { AttachmentConsumer } from './attachment';
import { newid } from '@diagram-craft/utils/id';
import { LayerManager, LayerManagerCRDT } from './diagramLayerManager';
import { RegularLayer } from './diagramLayerRegular';
import { Layer } from './diagramLayer';
import { assertRegularLayer } from './diagramLayerUtils';
import { watch, WatchableValue } from '@diagram-craft/utils/watchableValue';
import { CommentManager, type SerializedComment } from './comment';
import type { Point } from '@diagram-craft/geometry/point';
import { ElementLookup } from './elementLookup';
import type { CRDTMap, FlatCRDTMap } from '@diagram-craft/collaboration/crdt';
import { CRDTProp } from '@diagram-craft/collaboration/datatypes/crdtProp';
import { CRDTObject } from '@diagram-craft/collaboration/datatypes/crdtObject';
import { type DiagramBounds, DEFAULT_CANVAS } from './diagramBounds';
import type { Guide } from './guides';
import { SpatialIndex } from './spatialIndex';

export type DiagramIteratorOpts = {
  nest?: boolean;
  earlyExit?: boolean;
  filter?: (d: Diagram) => boolean;
};

export function* diagramIterator(
  arr: readonly Diagram[],
  opts: DiagramIteratorOpts
): Generator<Diagram> {
  for (const d of arr) {
    if (opts.filter && !opts.filter(d)) continue;
    if (d.parent && !opts.nest) continue;

    yield d;

    if (opts.earlyExit) return;
  }
}

export type DiagramEvents = {
  /* Diagram props, canvas have changed
   */
  diagramChange: { diagram: Diagram };

  /* A single element has changed (e.g. moved, resized, etc) */
  elementChange: { element: DiagramElement; silent?: boolean };

  /* A new element has been added to the diagram */
  elementAdd: { element: DiagramElement };

  /* An element has been removed from the diagram */
  elementRemove: { element: DiagramElement };

  /* An element has highlights changed */
  elementHighlighted: { element: DiagramElement };

  /* A batch operation has completed,
   * This event is triggered in *addition* to the elementChange event
   * for each element that has changed.
   */
  elementBatchChange: {
    removed: DiagramElement[];
    added: DiagramElement[];
    updated: DiagramElement[];
  };
};

/** @namespace */
export const DocumentBuilder = {
  empty: (id: string, name: string, document: DiagramDocument) => {
    const diagram = new Diagram(id, name, document);
    const layer = new RegularLayer('default', 'Default', [], diagram);
    diagram.layers.add(layer, UnitOfWork.immediate(diagram));
    return { diagram, layer };
  }
};

/** @internal */
export type DiagramCRDT = {
  id: string;
  parent: string | undefined;
  name: string;
  canvas: Omit<Box, 'r'>;
  props: FlatCRDTMap;
  layers: CRDTMap<LayerManagerCRDT>;
  guides: CRDTMap<Record<string, Guide>>;
  comments: CRDTMap<Record<string, SerializedComment>>;
};

export class Diagram extends EventEmitter<DiagramEvents> implements AttachmentConsumer {
  // Transient properties
  #document: DiagramDocument | undefined;
  #spatialIndex: SpatialIndex | undefined;

  readonly uid = newid();
  readonly _crdt: WatchableValue<CRDTMap<DiagramCRDT>>;
  hasEdgesWithLineHops = false;

  // Shared properties
  readonly #name: CRDTProp<DiagramCRDT, 'name'>;
  readonly #id: CRDTProp<DiagramCRDT, 'id'>;
  readonly #parent: CRDTProp<DiagramCRDT, 'parent'>;
  readonly _: CRDTProp<DiagramCRDT, 'canvas'>;
  readonly #props: CRDTObject<DiagramCraft.DiagramProps>;
  readonly #guides: CRDTMap<Record<string, Guide>>;

  readonly layers: LayerManager;

  // Unshared properties
  readonly selection = new Selection(this);
  readonly viewBox: Viewbox;
  readonly nodeLookup = new ElementLookup<DiagramNode>();
  readonly edgeLookup = new ElementLookup<DiagramEdge>();
  readonly undoManager = new UndoManager(this);

  readonly commentManager: CommentManager;

  constructor(
    id: string,
    name: string,
    document: DiagramDocument,
    crdt?: CRDTMap<DiagramCRDT>,
    canvasSize?: Extent,
    canvasOffset?: Point
  ) {
    super();

    // TODO: This WatchableValue is not fully used correctly
    this._crdt = watch(crdt ?? document.root.factory.makeMap());

    this.#document = document;

    this.#name = new CRDTProp(this._crdt, 'name', {
      onRemoteChange: () => this.emitDiagramChange('metadata'),
      initialValue: name
    });
    this.#id = new CRDTProp(this._crdt, 'id', {
      onRemoteChange: () => this.emitDiagramChange('metadata'),
      initialValue: id,
      cache: true
    });
    this.#parent = new CRDTProp(this._crdt, 'parent', {
      onRemoteChange: () => this.emitDiagramChange('metadata')
    });
    const initialCanvas = {
      w: Math.max(DEFAULT_CANVAS.w, canvasSize?.w ?? 0),
      h: Math.max(DEFAULT_CANVAS.h, canvasSize?.h ?? 0),
      x: 0,
      y: 0
    };

    this._ = new CRDTProp(this._crdt, 'canvas', {
      onRemoteChange: () => this.emitDiagramChange('content'),
      initialValue: initialCanvas
    });

    this.#props = new CRDTObject<DiagramCraft.DiagramProps>(
      watch(this._crdt.get().get('props', () => document.root.factory.makeMap())!),
      () => this.emitDiagramChange('content')
    );

    this.layers = new LayerManager(
      this,
      this._crdt.get().get('layers', () => document.root.factory.makeMap())!
    );

    this.#guides = this._crdt.get().get('guides', () => document.root.factory.makeMap())!;
    this.#guides.on('remoteAfterTransaction', () => this.emitDiagramChange('content'));

    this.viewBox = new Viewbox(this.bounds);

    if (canvasOffset) this.viewBox.offset = canvasOffset;

    const toggleHasEdgesWithLineHops = (type: 'add' | 'remove' | 'change', e: DiagramElement) => {
      if (type === 'add' && this.hasEdgesWithLineHops) return;
      if (!(e instanceof SimpleDiagramEdge)) return;

      const needsLineHops = e.renderProps.lineHops.type !== 'none';
      if (type === 'add' && (!needsLineHops || this.hasEdgesWithLineHops)) return;
      if (type === 'remove' && !needsLineHops) return;
      if (type === 'change' && needsLineHops === this.hasEdgesWithLineHops) return;

      const old = this.hasEdgesWithLineHops;
      this.hasEdgesWithLineHops = this.visibleElements().some(
        e => isEdge(e) && e.renderProps.lineHops.type !== 'none'
      );
      // Only trigger invalidation in case the value has changed to true
      if (this.hasEdgesWithLineHops && this.hasEdgesWithLineHops !== old) {
        if (!(this.activeLayer instanceof RegularLayer)) return;

        const uow = new UnitOfWork(this);
        this.activeLayer.elements.filter(isEdge).forEach(e => e.invalidate(uow));
        uow.commit();
      }
    };
    this.on('elementChange', e => toggleHasEdgesWithLineHops('change', e.element));
    this.on('elementAdd', e => toggleHasEdgesWithLineHops('add', e.element));
    this.on('elementRemove', e => toggleHasEdgesWithLineHops('remove', e.element));

    this.commentManager = new CommentManager(
      this,
      this._crdt.get().get('comments', () => document.root.factory.makeMap())!
    );

    // TODO: Is this still needed?
    //this.on('change', () => clearCacheForDiagram(this));

    bindElementListeners(this);
  }

  get id() {
    return this.#id.getNonNull();
  }

  get name() {
    return this.#name.getNonNull();
  }

  set name(n: string) {
    this.#name.set(n);
    this.emitDiagramChange('metadata');
  }

  get props() {
    return this.#props.get();
  }

  updateProps(callback: (props: DiagramCraft.DiagramProps) => void) {
    this.#props.update(callback);
    this.emitDiagramChange('content');
  }

  get parent() {
    return this.#parent.get();
  }

  set _parent(p: string | undefined) {
    this.#parent.set(p);
    this.emitDiagramChange('metadata');
  }

  get diagrams(): Diagram[] {
    return [...this.#document!.diagramIterator({ nest: true })].filter(d => d.parent === this.id);
  }

  get crdt() {
    return this._crdt.get();
  }

  get activeLayer() {
    return this.layers.active;
  }

  set _document(d: DiagramDocument) {
    this.#document = d;
  }

  get document(): DiagramDocument {
    return this.#document!;
  }

  *allElements(): Generator<DiagramElement> {
    yield* this.nodeLookup.values();
    yield* this.edgeLookup.values();

    // Need to handle all referenced layers separately as the edgeLookup and nodeLookup
    // won't contain these elements
    for (const l of this.layers.all) {
      if (l.type !== 'reference') continue;

      const resolved = l.resolve();
      if (resolved?.type === 'regular') {
        for (const e of (resolved as RegularLayer).elements) {
          yield e;
        }
      }
    }
  }

  visibleElements() {
    return this.layers.visible.flatMap(l => (l instanceof RegularLayer ? l.elements : []));
  }

  // Exposed for query purposes
  get elements() {
    return [...this.visibleElements()];
  }

  lookup(id: string): DiagramElement | undefined {
    return this.nodeLookup.get(id) ?? this.edgeLookup.get(id);
  }

  register(element: DiagramElement) {
    if (isNode(element)) this.nodeLookup.set(element.id, element);
    else if (isEdge(element)) this.edgeLookup.set(element.id, element);
  }

  get index(): SpatialIndex {
    if (!this.#spatialIndex) {
      this.#spatialIndex = new SpatialIndex(this);
    }
    return this.#spatialIndex;
  }

  get bounds() {
    return this._.getNonNull();
  }

  set bounds(b: DiagramBounds) {
    this._.set(b);
    this.emitDiagramChange('content');
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

  getAttachmentsInUse() {
    return this.layers.getAttachmentsInUse();
  }

  get guides(): ReadonlyArray<Guide> {
    return Array.from(this.#guides.values());
  }

  addGuide(guide: Omit<Guide, 'id'> & { id?: string }): Guide {
    const fullGuide: Guide = { id: guide.id ?? newid(), ...guide };
    this.#guides.set(fullGuide.id, fullGuide);
    this.emitDiagramChange('content');
    return fullGuide;
  }

  removeGuide(id: string) {
    this.#guides.delete(id);
    this.emitDiagramChange('content');
  }

  updateGuide(id: string, updates: Partial<Omit<Guide, 'id'>>) {
    const existing = this.#guides.get(id);
    assert.present(existing);

    this.#guides.set(id, { ...existing, ...updates });
    this.emitDiagramChange('content');
  }

  emitDiagramChange(type: 'content' | 'metadata') {
    this.emit('diagramChange', { diagram: this });
    if (type === 'metadata') {
      this.document.emit('diagramChanged', { diagram: this });
    }
  }
}
