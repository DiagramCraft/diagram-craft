import type { DiagramEdge, EdgePropsForEditing, EdgePropsForRendering } from './diagramEdge';
import type {
  DiagramNode,
  DuplicationContext,
  NodePropsForEditing,
  NodePropsForRendering
} from './diagramNode';
import { Transform } from '@diagram-craft/geometry/transform';
import { Box } from '@diagram-craft/geometry/box';
import { getRemoteUnitOfWork, UnitOfWork } from './unitOfWork';
import type { Diagram } from './diagram';
import { AttachmentConsumer } from './attachment';
import { FlatObject } from '@diagram-craft/utils/types';
import { PropPath, PropPathValue } from '@diagram-craft/utils/propertyPath';
import { assert } from '@diagram-craft/utils/assert';
import type { RegularLayer } from './diagramLayerRegular';
import { watch, WatchableValue } from '@diagram-craft/utils/watchableValue';
import { makeElementMapper } from './diagramElementMapper';
import type { ModificationLayer } from './diagramLayerModification';
import type { Comment } from './comment';
import type { PropertyInfo } from './property';
import type { CRDTMap, FlatCRDTMap } from '@diagram-craft/collaboration/crdt';
import {
  MappedCRDTOrderedMap,
  type MappedCRDTOrderedMapMapType
} from '@diagram-craft/collaboration/datatypes/mapped/mappedCrdtOrderedMap';
import { CRDTObject } from '@diagram-craft/collaboration/datatypes/crdtObject';
import { MappedCRDTProp } from '@diagram-craft/collaboration/datatypes/mapped/mappedCrdtProp';

// biome-ignore lint/suspicious/noExplicitAny: false positive
type Snapshot = any;

export type ElementPropsForEditing = EdgePropsForEditing | NodePropsForEditing;
export type ElementPropsForRendering = EdgePropsForRendering | NodePropsForRendering;

export type DiagramElementCRDT = {
  id: string;
  type: string;
  tags: Array<string>;
  metadata: FlatCRDTMap;
  children: CRDTMap<MappedCRDTOrderedMapMapType<DiagramElementCRDT>>;
  parentId: string;
};

type CacheKeys = 'name' | 'props.forEditing' | 'props.forRendering' | string;

export type ElementType = 'node' | 'delegating-node' | 'edge' | 'delegating-edge';

export interface DiagramElement {
  trackableType: 'element';

  readonly id: string;
  readonly type: ElementType;

  getAttachmentsInUse(): Array<string>;

  invalidate(uow: UnitOfWork): void;
  detach(uow: UnitOfWork): void;
  duplicate(ctx?: DuplicationContext, id?: string): DiagramElement;
  transform(transforms: ReadonlyArray<Transform>, uow: UnitOfWork, isChild?: boolean): void;

  readonly bounds: Box;
  setBounds(bounds: Box, uow: UnitOfWork): void;

  readonly name: string;
  readonly dataForTemplate: FlatObject;
  readonly editProps: ElementPropsForEditing;
  readonly renderProps: ElementPropsForRendering;
  readonly storedProps: ElementProps;

  getPropsInfo<T extends PropPath<ElementProps>>(
    path: T
  ): PropertyInfo<PropPathValue<ElementProps, T>>;

  updateProps(callback: (props: NodeProps | EdgeProps) => void, uow: UnitOfWork): void;

  snapshot(): Snapshot;
  restore(snapshot: Snapshot, uow: UnitOfWork): void;

  detachCRDT(callback: () => void): void;

  readonly crdt: WatchableValue<CRDTMap<DiagramElementCRDT>>;

  isLocked(): boolean;
  isHidden(): boolean;

  _setLayer(layer: RegularLayer | ModificationLayer, diagram: Diagram): void;
  readonly diagram: Diagram;
  readonly layer: RegularLayer | ModificationLayer;
  activeDiagram: Diagram;

  readonly parent: DiagramElement | undefined;
  _setParent(parent: DiagramElement | undefined): void;

  readonly metadata: ElementMetadata;
  readonly metadataCloned: ElementMetadata;
  updateMetadata(callback: (props: ElementMetadata) => void, uow: UnitOfWork): void;

  readonly tags: ReadonlyArray<string>;
  setTags(tags: ReadonlyArray<string>, uow: UnitOfWork): void;

  readonly cache: Map<CacheKeys, unknown>;
  clearCache(): void;

  readonly children: ReadonlyArray<DiagramElement>;
  setChildren(children: ReadonlyArray<DiagramElement>, uow: UnitOfWork): void;
  addChild(
    child: DiagramElement,
    uow: UnitOfWork,
    relation?: { ref: DiagramElement; type: 'after' | 'before' }
  ): void;
  removeChild(child: DiagramElement, uow: UnitOfWork): void;

  comments: ReadonlyArray<Comment>;
}

export abstract class AbstractDiagramElement implements DiagramElement, AttachmentConsumer {
  readonly trackableType = 'element';

  // Transient properties
  protected readonly _crdt: WatchableValue<CRDTMap<DiagramElementCRDT>>;

  protected _diagram: Diagram;
  protected _layer: RegularLayer | ModificationLayer;
  protected _activeDiagram: Diagram;

  // The cache is created lazily for performance reasons
  private _cache: Map<CacheKeys, unknown> | undefined = undefined;

  // Shared properties
  protected readonly _metadata: CRDTObject<ElementMetadata>;
  protected readonly _children: MappedCRDTOrderedMap<DiagramElement, DiagramElementCRDT>;
  protected readonly _parent: MappedCRDTProp<
    DiagramElementCRDT,
    'parentId',
    DiagramElement | undefined
  >;

  protected constructor(
    public readonly type: ElementType,
    public readonly id: string,
    layer: RegularLayer | ModificationLayer,
    crdt?: CRDTMap<DiagramElementCRDT>
  ) {
    this._diagram = layer.diagram;
    this._layer = layer;
    this._activeDiagram = this._diagram;

    this._crdt = watch(crdt ?? layer.crdt.factory.makeMap());
    this._crdt.get().set('id', id);
    this._crdt.get().set('type', type);

    // Initialize tags if not already set
    if (!this._crdt.get().has('tags')) {
      this._crdt.get().set('tags', []);
    }

    this._children = new MappedCRDTOrderedMap<DiagramElement, DiagramElementCRDT>(
      WatchableValue.from(
        ([m]) => m.get().get('children', () => layer.crdt.factory.makeMap())!,
        [this._crdt]
      ),
      makeElementMapper(this.layer, undefined),
      {
        onRemoteAdd: e => {
          this._diagram.register(e);

          const uow = getRemoteUnitOfWork(this._diagram);
          uow.addElement(e);
          uow.updateElement(this);
        },
        onRemoteChange: e => {
          const uow = getRemoteUnitOfWork(this._diagram);
          uow.updateElement(e);
          uow.updateElement(this);
        },
        onRemoteRemove: e => {
          const uow = getRemoteUnitOfWork(this._diagram);
          uow.removeElement(e);
          uow.updateElement(this);
        },
        onInit: e => this._diagram.register(e)
      }
    );

    this._parent = new MappedCRDTProp<DiagramElementCRDT, 'parentId', DiagramElement | undefined>(
      this._crdt,
      'parentId',
      {
        toCRDT: parent => parent?.id ?? '',
        fromCRDT: v => (v !== '' ? this._diagram.lookup(v) : undefined)
      }
    );
    this._parent.init(undefined);

    const metadataMap = WatchableValue.from(
      ([parent]) => parent.get().get('metadata', () => layer.crdt.factory.makeMap())!,
      [this._crdt] as const
    );

    this._metadata = new CRDTObject<ElementMetadata>(metadataMap, () => {
      this.invalidate(UnitOfWork.immediate(this._diagram));
      this._diagram.emit('elementChange', { element: this });
      this.clearCache();
    });
  }

  abstract getAttachmentsInUse(): Array<string>;

  abstract invalidate(uow: UnitOfWork): void;
  abstract detach(uow: UnitOfWork): void;
  abstract duplicate(ctx?: DuplicationContext, id?: string): DiagramElement;
  abstract transform(
    transforms: ReadonlyArray<Transform>,
    uow: UnitOfWork,
    isChild?: boolean
  ): void;

  abstract readonly bounds: Box;
  abstract setBounds(bounds: Box, uow: UnitOfWork): void;

  abstract readonly name: string;
  abstract readonly dataForTemplate: FlatObject;
  abstract editProps: ElementPropsForEditing;
  abstract renderProps: ElementPropsForRendering;
  abstract storedProps: ElementProps;

  abstract getPropsInfo<T extends PropPath<ElementProps>>(
    path: T
  ): PropertyInfo<PropPathValue<ElementProps, T>>;

  abstract updateProps(callback: (props: NodeProps | EdgeProps) => void, uow: UnitOfWork): void;

  abstract snapshot(): Snapshot;
  abstract restore(snapshot: Snapshot, uow: UnitOfWork): void;

  detachCRDT(callback: () => void = () => {}) {
    const clone = this._crdt.get().clone();
    callback();
    this._crdt.set(clone);
  }

  get crdt() {
    return this._crdt;
  }

  /* Flags *************************************************************************************************** */

  isLocked() {
    return this.layer.isLocked();
  }

  isHidden() {
    return this.renderProps.hidden;
  }

  /* Diagram/layer ******************************************************************************************* */

  _setLayer(layer: RegularLayer | ModificationLayer, diagram: Diagram) {
    this._layer = layer;
    this._diagram = diagram;
  }

  get diagram() {
    return this._diagram;
  }

  get layer() {
    return this._layer;
  }

  get activeDiagram() {
    return this._activeDiagram;
  }

  set activeDiagram(diagram: Diagram) {
    if (this._activeDiagram !== diagram) {
      this.cache.clear();
    }
    this._activeDiagram = diagram;
  }

  /* Parent ************************************************************************************************** */

  get parent() {
    return this._parent.get();
  }

  _setParent(parent: DiagramElement | undefined) {
    this._parent.set(parent);
  }

  /* Metadata ************************************************************************************************ */

  get metadata() {
    return (this._metadata.get() ?? {}) as ElementMetadata;
  }

  get metadataCloned() {
    return this._metadata.getClone() as ElementMetadata;
  }

  protected forceUpdateMetadata(metadata: ElementMetadata) {
    this._metadata.set(metadata);
  }

  updateMetadata(callback: (props: ElementMetadata) => void, uow: UnitOfWork) {
    uow.snapshot(this);
    const metadata = this._metadata.getClone() as ElementMetadata;
    callback(metadata);
    this._metadata.set(metadata);
    uow.updateElement(this);
    this.clearCache();
  }

  /* Tags ******************************************************************************************************** */

  get tags(): readonly string[] {
    return this._crdt.get().get('tags') ?? [];
  }

  setTags(tags: ReadonlyArray<string>, uow: UnitOfWork) {
    uow.snapshot(this);
    const uniqueTags = Array.from(new Set(tags.map(t => t.trim()).filter(t => t)));
    this._crdt.get().set('tags', uniqueTags);

    // Add all element tags to the document tags collection
    uniqueTags.forEach(tag => {
      this.diagram.document.tags.add(tag);
    });

    uow.updateElement(this);
    this.clearCache();
  }

  /* Cache *************************************************************************************************** */

  get cache() {
    if (!this._cache) {
      this._cache = new Map<CacheKeys, unknown>();
    }
    return this._cache;
  }

  clearCache() {
    this._cache?.clear();
  }

  /* Children ************************************************************************************************ */

  get children() {
    return this._children.values;
  }

  setChildren(children: ReadonlyArray<DiagramElement>, uow: UnitOfWork) {
    uow.snapshot(this);

    const oldChildren = this._children.values;

    children.forEach(c => c.detachCRDT(() => {}));
    this._children.set(children.map(e => [e.id, e]));

    this._children.values.forEach(c => {
      uow.snapshot(c);
      c._setParent(this);
      this.diagram.register(c);
    });

    // TODO: We should update nodeLookup and edgeLookup here
    oldChildren
      .filter(c => !children.includes(c))
      .forEach(c => {
        uow.removeElement(c);
        c._setParent(undefined);
      });

    this._children.values.forEach(c => {
      uow.updateElement(c);
    });
    uow.updateElement(this);
  }

  addChild(
    child: DiagramElement,
    uow: UnitOfWork,
    relation?: { ref: DiagramElement; type: 'after' | 'before' }
  ) {
    assert.true(child.diagram === this.diagram);
    assert.false(this._children.has(child.id));

    uow.snapshot(this);
    uow.snapshot(child);

    // TODO: Check so the same not can't be added multiple times

    if (relation) {
      const children = this._children;
      const index = children.getIndex(relation.ref.id);
      if (relation.type === 'after') {
        this._children.set(
          [...children.values.slice(0, index + 1), child, ...children.values.slice(index + 1)].map(
            e => [e.id, e]
          )
        );
      } else {
        this._children.set(
          [...children.values.slice(0, index), child, ...children.values.slice(index)].map(e => [
            e.id,
            e
          ])
        );
      }
    } else {
      this._children.add(child.id, child);
    }
    child._setParent(this);

    this.diagram.register(child);

    uow.updateElement(this);
    uow.updateElement(child);
  }

  removeChild(child: DiagramElement, uow: UnitOfWork) {
    assert.true(this._children.has(child.id));

    uow.snapshot(this);
    uow.snapshot(child);

    this._children.remove(child.id);
    child._setParent(undefined);

    // TODO: We should clear nodeLookup and edgeLookup here

    uow.updateElement(this);
    uow.removeElement(child);
  }

  get comments() {
    return this.diagram.commentManager.getAll().filter(c => c.element?.id === this.id);
  }
}

export const getDiagramElementPath = (element: DiagramElement): DiagramElement[] => {
  const dest: DiagramElement[] = [];
  let current: DiagramElement | undefined = element.parent;
  while (current !== undefined) {
    dest.push(current);
    current = current.parent;
  }
  return dest;
};

export const getTopMostNode = (element: DiagramElement): DiagramElement => {
  if (element.parent === undefined) return element;
  const path = getDiagramElementPath(element);
  return path.length > 0 ? path[path.length - 1]! : element;
};

export const transformElements = (
  elements: ReadonlyArray<DiagramElement>,
  transforms: ReadonlyArray<Transform>,
  uow: UnitOfWork
) => {
  for (const el of elements) {
    el.transform(transforms, uow);
  }

  // We do this in a separate loop to as nodes might move which will
  // affect the start and end location of connected edges
  for (const el of elements) {
    uow.updateElement(el);
  }
};

export const bindElementListeners = (diagram: Diagram) => {
  /* On comment change ----------------------------------------------- */
  const commentListener = (elementId: string | undefined) => {
    if (!elementId) return;
    const element = diagram.lookup(elementId);
    if (!element) return;

    element.clearCache();
    diagram.emit('elementChange', { element });
    diagram.emit('elementBatchChange', { updated: [element], removed: [], added: [] });
  };

  diagram.commentManager.on('commentUpdated', c => commentListener(c.comment.element?.id));
  diagram.commentManager.on('commentRemoved', c => commentListener(c.comment.elementId));
  diagram.commentManager.on('commentAdded', c => commentListener(c.comment.element?.id));

  /* On stylesheet change -------------------------------------------- */
  diagram.document.styles.on('stylesheetUpdated', s => {
    const id = s.stylesheet.id;

    const elements = new Set<DiagramElement>();
    for (const el of diagram.allElements()) {
      if (el.metadata.style === id || (isNode(el) && el.metadata.textStyle === id)) {
        elements.add(el);
      }
    }
    elements.forEach(e => {
      e.clearCache();
      e.diagram.emit('elementChange', { element: e });
    });
    diagram.emit('elementBatchChange', { added: [], removed: [], updated: [...elements] });
  });

  /* On layer change ------------------------------------------------- */
  diagram.layers.on(
    'layerStructureChange',
    () => {
      diagram.allElements().forEach(e => e.clearCache());
    },
    {
      priority: 1000
    }
  );
  // TODO: Ideally we should have this logic in BaseCanvasComponent instead
  //       ... and not reemit a layerStructureChange event, but rather just redraw in this case
  diagram.layers.on('layerUpdated', l => {
    if (l.layer.type === 'rule' || l.layer.type === 'modification') {
      diagram.layers.emit('layerStructureChange');
    }
  });
};

export const isNode = (e: DiagramElement | undefined): e is DiagramNode =>
  !!e && (e.type === 'node' || e.type === 'delegating-node');
export const isEdge = (e: DiagramElement | undefined): e is DiagramEdge =>
  !!e && (e.type === 'edge' || e.type === 'delegating-edge');

declare global {
  interface AssertTypeExtensions {
    node: (e: DiagramElement) => asserts e is DiagramNode;
    edge: (e: DiagramElement) => asserts e is DiagramEdge;
  }
}

assert.node = (e: DiagramElement): asserts e is DiagramNode => assert.true(isNode(e), 'not node');
assert.edge = (e: DiagramElement): asserts e is DiagramEdge => assert.true(isEdge(e), 'not edge');
