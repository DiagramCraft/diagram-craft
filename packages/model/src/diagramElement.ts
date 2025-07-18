import type { DiagramEdge, EdgePropsForEditing, EdgePropsForRendering } from './diagramEdge';
import type {
  DiagramNode,
  DuplicationContext,
  NodePropsForEditing,
  NodePropsForRendering
} from './diagramNode';
import { ElementInterface } from './types';
import { Transform } from '@diagram-craft/geometry/transform';
import { Box } from '@diagram-craft/geometry/box';
import { UnitOfWork } from './unitOfWork';
import { Layer } from './diagramLayer';
import type { Diagram } from './diagram';
import { AttachmentConsumer } from './attachment';
import { FlatObject } from '@diagram-craft/utils/types';
import { PropertyInfo } from '@diagram-craft/main/react-app/toolwindow/ObjectToolWindow/types';
import { PropPath, PropPathValue } from '@diagram-craft/utils/propertyPath';
import { assert } from '@diagram-craft/utils/assert';
import type { RegularLayer } from './diagramLayerRegular';
import { type CRDTMap, type Flatten } from './collaboration/crdt';
import { WatchableValue } from '@diagram-craft/utils/watchableValue';
import { CRDTProp } from './collaboration/datatypes/crdtProp';
import { CRDTObject } from './collaboration/datatypes/crdtObject';
import {
  MappedCRDTOrderedMap,
  type MappedCRDTOrderedMapMapType
} from './collaboration/datatypes/mapped/mappedCrdtOrderedMap';
import { makeElementMapper } from './diagramElementMapper';
import { MappedCRDTProp } from './collaboration/datatypes/mapped/mappedCrdtProp';

// eslint-disable-next-line
type Snapshot = any;

export type ElementPropsForEditing = EdgePropsForEditing | NodePropsForEditing;
export type ElementPropsForRendering = EdgePropsForRendering | NodePropsForRendering;

export type DiagramElementCRDT = {
  id: string;
  type: string;
  highlights: Array<string>;
  metadata: CRDTMap<Flatten<ElementMetadata>>;
  children: CRDTMap<MappedCRDTOrderedMapMapType<DiagramElementCRDT>>;
  parentId: string;
};

export abstract class DiagramElement implements ElementInterface, AttachmentConsumer {
  readonly trackableType = 'element';

  // Transient properties
  protected readonly _crdt: WatchableValue<CRDTMap<DiagramElementCRDT>>;

  protected _diagram: Diagram;

  // TODO: Is this always a RegularLayer
  protected _layer: Layer;
  protected _activeDiagram: Diagram;

  protected _cache: Map<string, unknown> | undefined = undefined;

  // Shared properties
  protected readonly _metadata: CRDTObject<ElementMetadata>;
  protected readonly _highlights: CRDTProp<DiagramElementCRDT, 'highlights'>;
  protected readonly _children: MappedCRDTOrderedMap<DiagramElement, DiagramElementCRDT>;
  protected readonly _parent: MappedCRDTProp<
    DiagramElementCRDT,
    'parentId',
    DiagramElement | undefined
  >;

  protected constructor(
    type: string,
    id: string,
    layer: Layer,
    crdt?: CRDTMap<DiagramElementCRDT>
  ) {
    this._diagram = layer.diagram;
    this._layer = layer;
    this._activeDiagram = this._diagram;

    this._crdt = new WatchableValue(crdt ?? this._diagram.document.root.factory.makeMap());
    this._crdt.get().set('id', id);
    this._crdt.get().set('type', type);

    this._children = new MappedCRDTOrderedMap<DiagramElement, DiagramElementCRDT>(
      this._crdt.get().get('children', () => this._diagram.document.root.factory.makeMap())!,
      makeElementMapper(this.layer),
      {
        allowUpdates: true,
        onAdd: (t, e) => {
          if (t === 'remote') {
            this._diagram.register(e);
            this._diagram.emit('elementChange', { element: e });
            this._diagram.emit('elementChange', { element: this });
          }
        },
        onChange: (t, e) => {
          if (t === 'remote') {
            this._diagram.emit('elementChange', { element: e });
            this._diagram.emit('elementChange', { element: this });
          }
        },
        onRemove: (t, e) => {
          if (t === 'remote') {
            this._diagram.emit('elementRemove', { element: e });
            this._diagram.emit('elementChange', { element: this });
          }
        },
        onInit: e => this._diagram.register(e)
      }
    );

    this._highlights = new CRDTProp(this._crdt, 'highlights', {
      factory: () => [],
      onChange: () => {
        this._diagram.emitAsync('elementHighlighted', { element: this });
      }
    });

    this._parent = new MappedCRDTProp<DiagramElementCRDT, 'parentId', DiagramElement | undefined>(
      this._crdt,
      'parentId',
      {
        toCRDT: parent => parent?.id ?? '',
        fromCRDT: v => (v !== '' ? this._diagram.lookup(v) : undefined)
      },
      {
        onChange: type => {
          if (type !== 'remote') return;
        }
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
      this._cache?.clear();
    });
  }

  abstract getAttachmentsInUse(): Array<string>;

  abstract invalidate(uow: UnitOfWork): void;
  abstract detach(uow: UnitOfWork): void;
  abstract duplicate(ctx?: DuplicationContext, id?: string | undefined): DiagramElement;
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

  get id() {
    return this._crdt.get().get('id')!;
  }

  get type() {
    return this._crdt.get().get('type')!;
  }

  /* Flags *************************************************************************************************** */

  isLocked() {
    return this.layer.isLocked();
  }

  isHidden() {
    return this.renderProps.hidden;
  }

  /* Diagram/layer ******************************************************************************************* */

  _setLayer(layer: RegularLayer, diagram: Diagram) {
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

  /* Highlights ********************************************************************************************** */

  set highlights(highlights: ReadonlyArray<string>) {
    this._highlights.set(highlights as Array<string>);
    this.diagram.emitAsync('elementHighlighted', { element: this });
  }

  get highlights() {
    return this._highlights.get() ?? [];
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
    const metadata = this._metadata.getClone()! as ElementMetadata;
    callback(metadata);
    this._metadata.set(metadata);
    uow.updateElement(this);
    this._cache?.clear();
  }

  /* Cache *************************************************************************************************** */

  get cache() {
    if (!this._cache) {
      this._cache = new Map<string, unknown>();
    }
    return this._cache;
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
  const path = getDiagramElementPath(element);
  return path.length > 0 ? path[path.length - 1] : element;
};

export const isNode = (e: DiagramElement | undefined): e is DiagramNode => !!e && e.type === 'node';
export const isEdge = (e: DiagramElement | undefined): e is DiagramEdge => !!e && e.type === 'edge';

declare global {
  interface AssertTypeExtensions {
    node: (e: DiagramElement) => asserts e is DiagramNode;
    edge: (e: DiagramElement) => asserts e is DiagramEdge;
  }
}

assert.node = (e: DiagramElement): asserts e is DiagramNode => assert.true(isNode(e), 'not node');
assert.edge = (e: DiagramElement): asserts e is DiagramEdge => assert.true(isEdge(e), 'not edge');
