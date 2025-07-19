import { LabelNode } from './types';
import { Box } from '@diagram-craft/geometry/box';
import { Transform } from '@diagram-craft/geometry/transform';
import { DiagramElement, type DiagramElementCRDT, isEdge, isNode } from './diagramElement';
import { DiagramNodeSnapshot, UnitOfWork, UOWTrackable } from './unitOfWork';
import type { DiagramEdge, ResolvedLabelNode } from './diagramEdge';
import { Layer } from './diagramLayer';
import { DefaultStyles, nodeDefaults } from './diagramDefaults';
import {
  AnchorEndpoint,
  ConnectedEndpoint,
  Endpoint,
  FreeEndpoint,
  PointInNodeEndpoint
} from './endpoint';
import { DeepReadonly, DeepRequired, makeWriteable } from '@diagram-craft/utils/types';
import { deepClone, deepMerge } from '@diagram-craft/utils/object';
import { assert, VERIFY_NOT_REACHED, VerifyNotReached } from '@diagram-craft/utils/assert';
import { newid } from '@diagram-craft/utils/id';
import { clamp } from '@diagram-craft/utils/math';
import { Point } from '@diagram-craft/geometry/point';
import { applyTemplate } from './template';
import { isEmptyString } from '@diagram-craft/utils/strings';
import { Anchor } from './anchor';
import { DynamicAccessor, PropPath, PropPathValue } from '@diagram-craft/utils/propertyPath';
import { PropertyInfo } from '@diagram-craft/main/react-app/toolwindow/ObjectToolWindow/types';
import { getAdjustments } from './diagramLayerRuleTypes';
import { toUnitLCS } from '@diagram-craft/geometry/pathListBuilder';
import type { RegularLayer } from './diagramLayerRegular';
import { transformPathList } from '@diagram-craft/geometry/pathListUtils';
import { WatchableValue } from '@diagram-craft/utils/watchableValue';
import type { CRDTMap, Flatten } from './collaboration/crdt';
import { CRDTProp } from './collaboration/datatypes/crdtProp';
import { MappedCRDTProp } from './collaboration/datatypes/mapped/mappedCrdtProp';
import { CRDTObject } from './collaboration/datatypes/crdtObject';
import { CRDTMapper } from './collaboration/datatypes/mapped/mappedCrdt';
import {
  MappedCRDTMap,
  type MappedCRDTMapMapType
} from './collaboration/datatypes/mapped/mappedCrdtMap';
import { unique } from '@diagram-craft/utils/array';

export type DuplicationContext = {
  targetElementsInGroup: Map<string, DiagramElement>;
};

export type NodePropsForRendering = DeepReadonly<DeepRequired<NodeProps>>;
export type NodePropsForEditing = DeepReadonly<NodeProps>;

export type NodeTexts = { text: string } & Record<string, string>;

export type DiagramNodeCRDT = DiagramElementCRDT & {
  nodeType: string;
  bounds: Box;
  text: CRDTMap<Flatten<NodeTexts>>;
  props: CRDTMap<Flatten<NodeProps>>;
  anchors: ReadonlyArray<Anchor> | undefined;
  edges: CRDTMap<MappedCRDTMapMapType<{ edges: Array<string> }>>;
};

const makeEdgesMapper = (node: DiagramNode): CRDTMapper<string[], { edges: Array<string> }> => {
  return {
    fromCRDT(e: CRDTMap<{ edges: Array<string> }>) {
      return e.get('edges')!;
    },

    toCRDT(e: string[]): CRDTMap<{ edges: Array<string> }> {
      const m = node.crdt.get().factory.makeMap<{ edges: Array<string> }>();
      m.set('edges', e);
      return m;
    }
  };
};

const DEFAULT_BOUNDS = { x: 0, y: 0, w: 10, h: 10, r: 0 };

export class DiagramNode extends DiagramElement implements UOWTrackable<DiagramNodeSnapshot> {
  // Shared properties
  readonly #nodeType: CRDTProp<DiagramNodeCRDT, 'nodeType'>;
  #edges: MappedCRDTMap<string[], { edges: Array<string> }>;

  // Note, we use MappedCRDTProp here for performance reasons
  readonly #bounds: MappedCRDTProp<DiagramNodeCRDT, 'bounds', Box>;
  readonly #text: CRDTObject<NodeTexts>;
  readonly #props: CRDTObject<NodeProps>;
  readonly #anchors: CRDTProp<DiagramNodeCRDT, 'anchors'>;

  constructor(
    id: string,
    layer: Layer,
    anchorCache?: ReadonlyArray<Anchor>,
    crdt?: CRDTMap<DiagramElementCRDT>
  ) {
    super('node', id, layer, crdt);

    const nodeCrdt = this._crdt as unknown as WatchableValue<CRDTMap<DiagramNodeCRDT>>;

    this.#edges = new MappedCRDTMap(
      nodeCrdt.get().get('edges', () => layer.crdt.factory.makeMap())!,
      makeEdgesMapper(this),
      true
    );

    this.#nodeType = new CRDTProp<DiagramNodeCRDT, 'nodeType'>(nodeCrdt, 'nodeType', {
      onRemoteChange: () => {
        this._children.clear();
        this.diagram.emit('elementChange', { element: this });

        this._cache?.clear();

        const uow = new UnitOfWork(this.diagram, false, true);
        this.invalidateAnchors(uow);
        this.getDefinition().onPropUpdate(this, uow);
      }
    });
    this.#nodeType.init('rect');

    const textMap = WatchableValue.from(
      ([parent]) => parent.get().get('text', () => layer.crdt.factory.makeMap())!,
      [nodeCrdt] as const
    );
    this.#text = new CRDTObject<NodeTexts>(textMap, () => {
      this.diagram.emit('elementChange', { element: this });
      this._cache?.clear();
    });
    this.#text.init({ text: '' });

    const propsMap = WatchableValue.from(
      ([parent]) => parent.get().get('props', () => layer.crdt.factory.makeMap())!,
      [nodeCrdt] as const
    );
    this.#props = new CRDTObject<NodeProps>(propsMap, () => {
      this.diagram.emit('elementChange', { element: this });
      this._cache?.clear();
    });

    this.#anchors = new CRDTProp<DiagramNodeCRDT, 'anchors'>(nodeCrdt, 'anchors', {
      onRemoteChange: () => {
        this.diagram.emit('elementChange', { element: this });
      }
    });
    if (anchorCache) this.#anchors.init(anchorCache);

    this.#bounds = new MappedCRDTProp<DiagramNodeCRDT, 'bounds', Box>(
      nodeCrdt,
      'bounds',
      {
        toCRDT: (b: Box) => b,
        fromCRDT: (b: Box) => b
      },
      {
        onRemoteChange: () => {
          this.diagram.emit('elementChange', { element: this });
          // TODO: Need to find a better solution to this
          this.diagram.emit('uowCommit', { added: [], removed: [], updated: [this] });
        }
      }
    );
    this.#bounds.init(DEFAULT_BOUNDS);

    // Note: It is important that this comes last, as it might trigger
    //       events etc - so important that everything is set up before
    //       that to avoid flashing of incorrect formatting/style
    if (this.#anchors.get() === undefined && this.diagram.layers) {
      this.invalidateAnchors(UnitOfWork.immediate(this.diagram));
    }
  }

  /* Factory ************************************************************************************************* */

  static create(
    id: string,
    nodeType: 'group' | string,
    bounds: Box,
    layer: Layer,
    props: NodePropsForEditing,
    metadata: ElementMetadata,
    text: NodeTexts = { text: '' },
    anchorCache?: ReadonlyArray<Anchor>
  ) {
    const node = new DiagramNode(id, layer, anchorCache);

    this.initializeNode(node, nodeType, bounds, props, metadata, text);

    return node;
  }

  protected static initializeNode(
    node: DiagramNode,
    nodeType: 'group' | string,
    bounds: Box,
    props: NodePropsForEditing,
    metadata: ElementMetadata,
    text: NodeTexts = { text: '' }
  ) {
    node.#bounds.set(bounds);
    node.#nodeType.set(nodeType);
    node.#text.set(text);

    node.#props.set((props ?? {}) as NodeProps);

    node._metadata.set(metadata ?? {});

    const m = node.metadata;
    if (!m.style || !m.textStyle) {
      m.style = node.nodeType === 'text' ? DefaultStyles.node.text : DefaultStyles.node.default;
      m.textStyle = DefaultStyles.text.default;
      node.forceUpdateMetadata(m);
    }
    node._cache?.clear();
  }

  detachCRDT(callback: () => void = () => {}) {
    super.detachCRDT(callback);

    const crdt = this._crdt as unknown as WatchableValue<CRDTMap<DiagramNodeCRDT>>;
    this.#edges = new MappedCRDTMap(
      crdt.get().get('edges', () => this.layer.crdt.factory.makeMap())!,
      makeEdgesMapper(this),
      true
    );
  }

  getDefinition() {
    return this.diagram.document.nodeDefinitions.get(this.nodeType);
  }

  get nodeType() {
    return this.#nodeType.get()!;
  }

  changeNodeType(nodeType: string, uow: UnitOfWork) {
    uow.snapshot(this);
    this.#nodeType.set(nodeType);
    this._children.clear();
    uow.updateElement(this);

    this._cache?.clear();
    this.invalidateAnchors(uow);
    this.getDefinition().onPropUpdate(this, uow);
  }

  /* Text **************************************************************************************************** */

  getText(id = 'text') {
    return this.#text.get()[id === '1' ? 'text' : id];
  }

  setText(text: string, uow: UnitOfWork, id = 'text') {
    uow.snapshot(this);
    this.#text.set({
      ...this.#text.get(),
      [id === '1' ? 'text' : id]: text
    });
    uow.updateElement(this);
    this._cache?.clear();
  }

  get texts() {
    return this.#text.get();
  }

  get textsCloned() {
    return this.#text.getClone();
  }

  /* Props *************************************************************************************************** */

  getPropsInfo<T extends PropPath<NodeProps>>(path: T): PropertyInfo<PropPathValue<NodeProps, T>> {
    const {
      parentProps,
      styleProps,
      textStyleProps,
      ruleProps,
      ruleStyleProps,
      ruleTextStyleProps
    } = this.getPropsSources();

    const accessor = new DynamicAccessor<NodeProps>();

    const dest: PropertyInfo<PropPathValue<NodeProps, T>> = [];

    dest.push({
      val: nodeDefaults.get(path) as PropPathValue<NodeProps, T>,
      type: 'default'
    });

    if (styleProps) {
      dest.push({
        val: accessor.get(styleProps, path) as PropPathValue<NodeProps, T>,
        type: 'style',
        id: this.metadata.style
      });
    }

    if (textStyleProps) {
      dest.push({
        val: accessor.get(textStyleProps, path) as PropPathValue<NodeProps, T>,
        type: 'textStyle',
        id: this.metadata.textStyle
      });
    }

    if (ruleStyleProps) {
      dest.push({
        val: accessor.get(ruleStyleProps, path) as PropPathValue<NodeProps, T>,
        type: 'ruleStyle'
      });
    }

    if (ruleTextStyleProps) {
      dest.push({
        val: accessor.get(ruleTextStyleProps, path) as PropPathValue<NodeProps, T>,
        type: 'ruleTextStyle'
      });
    }

    dest.push({
      val: accessor.get(parentProps, path) as PropPathValue<NodeProps, T>,
      type: 'parent'
    });

    dest.push({
      val: accessor.get(this.#props.get()! as NodeProps, path) as PropPathValue<NodeProps, T>,
      type: 'stored'
    });

    for (const rp of ruleProps) {
      dest.push({
        val: accessor.get(rp[1], path) as PropPathValue<NodeProps, T>,
        type: 'rule',
        id: rp[0]
      });
    }

    return dest.filter(e => e.val !== undefined);
  }

  private getPropsSources() {
    const styleProps = this.diagram.document.styles.getNodeStyle(this.metadata.style)?.props;

    const textStyleProps = this.diagram.document.styles.getTextStyle(
      this.metadata.textStyle
    )?.props;

    const parentProps: Partial<NodeProps & EdgeProps> = deepClone(
      this._parent.get() && this.#props.get().inheritStyle
        ? // @ts-expect-error this.#parent.editProps cannot be properly typed
          makeWriteable(this._parent.get().editProps)
        : {}
    );

    const adjustments = getAdjustments(this._activeDiagram, this.id);
    const ruleProps = adjustments.map(([k, v]) => [k, v.props]);

    const ruleElementStyle = adjustments
      .map(([, v]) => v.elementStyle)
      .filter(e => !!e)
      .at(-1);
    const ruleStyleProps = this.diagram.document.styles.getNodeStyle(ruleElementStyle)?.props ?? {};

    const ruleTextStyle = adjustments
      .map(([, v]) => v.textStyle)
      .filter(e => !!e)
      .at(-1);
    const ruleTextStyleProps =
      this.diagram.document.styles.getTextStyle(ruleTextStyle)?.props ?? {};

    return {
      parentProps,
      styleProps,
      textStyleProps,
      ruleProps: ruleProps as [string, NodeProps][],
      ruleStyleProps,
      ruleTextStyleProps
    };
  }

  protected populatePropsCache() {
    const {
      parentProps,
      styleProps,
      textStyleProps,
      ruleProps,
      ruleStyleProps,
      ruleTextStyleProps
    } = this.getPropsSources();

    // Let's not inherit the debug property - as it's useful to be able
    // to set this on individual nodes
    parentProps.debug = {};

    const consolidatedRulesProps = ruleProps.reduce(
      (p, c) => deepMerge<NodeProps>({}, p, c[1]),
      {}
    );

    const propsForEditing = deepMerge<NodeProps>(
      {},
      styleProps ?? {},
      textStyleProps ?? {},
      ruleStyleProps,
      ruleTextStyleProps,
      parentProps,
      this.#props.get() as NodeProps
    ) as DeepRequired<NodeProps>;

    const propsForRendering = nodeDefaults.applyDefaults(
      deepMerge({}, propsForEditing, consolidatedRulesProps)
    );

    this.cache.set('props.forEditing', propsForEditing);
    this.cache.set('props.forRendering', propsForRendering);

    for (const child of this.children) {
      if (isNode(child)) {
        child.populatePropsCache();
      }
    }

    return {
      forEditing: propsForEditing,
      forRendering: propsForRendering
    };
  }

  get storedProps() {
    return this.#props.get() as NodeProps;
  }

  get storedPropsCloned() {
    return this.#props.getClone() as NodeProps;
  }

  get editProps(): NodePropsForEditing {
    return (this.cache.get('props.forEditing') ??
      this.populatePropsCache().forEditing) as NodePropsForEditing;
  }

  get renderProps(): NodePropsForRendering {
    return (this.cache.get('props.forRendering') ??
      this.populatePropsCache().forRendering) as NodePropsForRendering;
  }

  updateProps(callback: (props: NodeProps) => void, uow: UnitOfWork) {
    uow.snapshot(this);
    this.#props.update(callback);
    uow.updateElement(this);

    this._cache?.clear();
    this.invalidateAnchors(uow);
    this.getDefinition().onPropUpdate(this, uow);
  }

  updateCustomProps<K extends keyof CustomNodeProps>(
    key: K,
    callback: (props: NonNullable<CustomNodeProps[K]>) => void,
    uow: UnitOfWork
  ) {
    this.updateProps(p => {
      p.custom ??= {};
      p.custom[key] ??= {};
      callback(p.custom[key]!);
    }, uow);
  }

  /* Name **************************************************************************************************** */

  get dataForTemplate() {
    if (this.isLabelNode()) return this.labelEdge()!.dataForTemplate;

    return deepMerge(
      {
        name: this.metadata.name
      },
      this.metadata.data?.customData ?? {},
      ...(this.metadata.data?.data?.map(d => d.data) ?? [])
    );
  }

  get name() {
    if (this._cache?.has('name')) return this._cache.get('name') as string;

    if (!isEmptyString(this.metadata.name)) {
      this.cache.set('name', this.metadata.name!);
      return this.cache.get('name') as string;
    }

    const text = this.getText();
    if (text) {
      const metadata = this.dataForTemplate;

      if (text[0] === '<') {
        try {
          const d = new DOMParser().parseFromString(text, 'text/html');
          const textContent = d.body.textContent;
          if (textContent) {
            this.cache.set('name', applyTemplate(textContent, metadata));
            return textContent;
          }
        } catch (e) {
          // Ignore
        }
      }

      this.cache.set('name', applyTemplate(text, metadata));
      return this.cache.get('name') as string;
    }
    return this.nodeType + ' / ' + this.id;
  }

  /* Children *********************************************************************************************** */

  setChildren(children: ReadonlyArray<DiagramElement>, uow: UnitOfWork) {
    super.setChildren(children, uow);

    uow.registerOnCommitCallback('onChildChanged', this, () => {
      this.getDefinition().onChildChanged(this, uow);
    });
  }

  addChild(
    child: DiagramElement,
    uow: UnitOfWork,
    relation?: { ref: DiagramElement; type: 'after' | 'before' }
  ) {
    super.addChild(child, uow, relation);

    uow.registerOnCommitCallback('onChildChanged', this, () => {
      this.getDefinition().onChildChanged(this, uow);
    });
  }

  removeChild(child: DiagramElement, uow: UnitOfWork) {
    super.removeChild(child, uow);

    uow.registerOnCommitCallback('onChildChanged', this, () => {
      this.getDefinition().onChildChanged(this, uow);
    });
  }

  /* Bounds ************************************************************************************************* */

  get bounds(): Box {
    return this.#bounds.getNonNull();
  }

  setBounds(bounds: Box, uow: UnitOfWork) {
    uow.snapshot(this);
    const oldBounds = this.bounds;
    this.#bounds.set(bounds);
    if (!Box.isEqual(oldBounds, this.bounds)) uow.updateElement(this);
  }

  /* Anchors ************************************************************************************************ */

  get anchors(): ReadonlyArray<Anchor> {
    // TODO: Can this be handled using cache
    if (this.#anchors.get() === undefined) {
      UnitOfWork.execute(this.diagram, uow => {
        this.invalidateAnchors(uow);
      });
    }

    return this.#anchors.get() ?? [];
  }

  getAnchor(anchor: string) {
    return this.anchors.find(a => a.id === anchor) ?? this.anchors[0];
  }

  /* Snapshot ************************************************************************************************ */

  toJSON() {
    return {
      id: this.id,
      parent: this.parent,
      type: 'node',
      nodeType: this.nodeType,
      bounds: this.bounds,
      props: this.#props,
      children: this.children,
      edges: Array.from(this.#edges.entries)
    };
  }

  snapshot(): DiagramNodeSnapshot {
    return {
      _snapshotType: 'node',
      id: this.id,
      parentId: this.parent?.id,
      type: 'node',
      nodeType: this.nodeType,
      bounds: deepClone(this.bounds),
      props: this.#props.getClone(),
      metadata: this._metadata.getClone() as ElementMetadata,
      children: this.children.map(c => c.id),
      edges: Object.fromEntries(
        Array.from(this.#edges.entries).map(([k, v]) => [k, v.map(e => ({ id: e }))])
      ),
      texts: this.#text.getClone()
    };
  }

  // TODO: Add assertions for lookups
  restore(snapshot: DiagramNodeSnapshot, uow: UnitOfWork) {
    this.setBounds(snapshot.bounds, uow);
    this.#props.set(snapshot.props as NodeProps);
    this._highlights.set([]);
    this.#nodeType.set(snapshot.nodeType);
    this.#text.set(snapshot.texts);
    this.forceUpdateMetadata(snapshot.metadata);

    this.setChildren(
      snapshot.children.map(c => {
        const el = this.diagram.lookup(c);
        if (!el) VERIFY_NOT_REACHED();
        return el!;
      }),
      uow
    );
    const edges = snapshot.edges ?? {};
    for (const [k, v] of Object.entries(edges)) {
      this.#edges.set(k, unique([...(this.#edges.get(k) ?? []), ...v.map(e => e.id!)]));
    }

    uow.updateElement(this);
    this._cache?.clear();
  }

  convertToPath(uow: UnitOfWork) {
    uow.snapshot(this);

    const paths = this.getDefinition().getBoundingPath(this);

    const scaledPath = transformPathList(paths, toUnitLCS(this.bounds));

    this.#nodeType.set('generic-path');
    this.updateProps(p => {
      p.custom ??= {};
      p.custom.genericPath = {};
      p.custom.genericPath.path = scaledPath.asSvgPath();
    }, uow);
  }

  duplicate(ctx?: DuplicationContext | undefined, id?: string | undefined): DiagramNode {
    const isTopLevel = ctx === undefined;
    const context = ctx ?? {
      targetElementsInGroup: new Map()
    };

    // The node might already have been duplicated being a label node of one of the edges
    if (context.targetElementsInGroup.has(this.id)) {
      return context.targetElementsInGroup.get(this.id) as DiagramNode;
    }

    const node = DiagramNode.create(
      id ?? newid(),
      this.nodeType,
      deepClone(this.bounds),
      this.layer,
      this.#props.getClone() as NodeProps,
      this._metadata.getClone() as ElementMetadata,
      this.#text.getClone() as NodeTexts,
      deepClone(this.#anchors.get())
    );

    context.targetElementsInGroup.set(this.id, node);

    // Phase 1 - duplicate all elements in the group
    const newChildren: DiagramElement[] = [];
    for (let i = 0; i < this.children.length; i++) {
      const c = this.children[i];
      const newElement = c.duplicate(context, id ? `${id}-${i}` : undefined);
      newChildren.push(newElement);
    }
    node.setChildren(newChildren, UnitOfWork.immediate(this.diagram));
    context.targetElementsInGroup.set(this.id, node);

    if (!isTopLevel) return node;

    // Phase 2 - update all edges to point to the new elements
    for (const e of node.getNestedElements()) {
      if (isEdge(e)) {
        let newStart: Endpoint;
        let newEnd: Endpoint;

        // TODO: This is duplicated. Can refactor?
        if (e.start instanceof ConnectedEndpoint) {
          const newStartNode = context.targetElementsInGroup.get(e.start.node.id);
          if (newStartNode) {
            if (e.start instanceof AnchorEndpoint) {
              newStart = new AnchorEndpoint(newStartNode as DiagramNode, e.start.anchorId);
            } else if (e.start instanceof PointInNodeEndpoint) {
              newStart = new PointInNodeEndpoint(
                newStartNode as DiagramNode,
                e.start.ref,
                e.start.offset,
                e.start.offsetType
              );
            } else {
              throw new VerifyNotReached();
            }
          } else {
            newStart = new FreeEndpoint(e.start.position);
          }
        } else {
          newStart = new FreeEndpoint(e.start.position);
        }

        if (e.end instanceof ConnectedEndpoint) {
          const newEndNode = context.targetElementsInGroup.get(e.end.node.id);
          if (newEndNode) {
            if (e.end instanceof AnchorEndpoint) {
              newEnd = new AnchorEndpoint(newEndNode as DiagramNode, e.end.anchorId);
            } else if (e.end instanceof PointInNodeEndpoint) {
              newEnd = new PointInNodeEndpoint(
                newEndNode as DiagramNode,
                e.end.ref,
                e.end.offset,
                e.end.offsetType
              );
            } else {
              throw new VerifyNotReached();
            }
          } else {
            newEnd = new FreeEndpoint(e.end.position);
          }
        } else {
          newEnd = new FreeEndpoint(e.end.position);
        }

        const uow = new UnitOfWork(this.diagram);
        e.setStart(newStart, uow);
        e.setEnd(newEnd, uow);
        uow.abort();
      }
    }

    return node;
  }

  /**
   * Called in case the node has been changed and needs to be recalculated
   *
   *  node -> attached edges -> label nodes -> ...
   *                         -> intersecting edges
   *       -> children -> attached edges -> label nodes -> ...          Note, cannot look at parent
   *                                     -> intersecting edges
   *       -> parent -> attached edges -> label nodes                   Note, cannot look at children
   *                                   -> intersecting edges
   *
   *  label node -> attached edge                                       Note, cannot revisit edge
   *             -> label edge                                          Note, cannot revisit node
   *
   */
  invalidate(uow: UnitOfWork) {
    uow.snapshot(this);

    // Prevent infinite recursion
    if (uow.hasBeenInvalidated(this)) return;
    uow.beginInvalidation(this);

    if (this.parent) {
      this.parent.invalidate(uow);
    }

    // Invalidate all attached edges
    for (const edge of this.listEdges()) {
      edge.invalidate(uow);
    }

    for (const child of this.children) {
      child.invalidate(uow);
    }

    if (this.isLabelNode()) {
      this.labelEdge()!.invalidate(uow);
    }
  }

  detach(uow: UnitOfWork) {
    this.diagram.nodeLookup.delete(this.id);

    // "Detach" any edges that connects to this node
    for (const anchor of this.#edges.keys) {
      for (const id of this.#edges.get(anchor) ?? []) {
        const edge = this.diagram.edgeLookup.get(id)!;
        let isChanged = false;
        if (edge.start instanceof ConnectedEndpoint && edge.start.node === this) {
          edge.setStart(new FreeEndpoint(edge.start.position), uow);
          isChanged = true;
        }
        if (edge.end instanceof ConnectedEndpoint && edge.end.node === this) {
          edge.setEnd(new FreeEndpoint(edge.end.position), uow);
          isChanged = true;
        }
        if (isChanged) uow.updateElement(edge);
      }
    }

    if (this.parent) {
      this.parent.removeChild(this, uow);
    }

    // Note, need to check if the element is still in the layer to avoid infinite recursion
    assert.true(this.layer.type === 'regular');
    if ((this.layer as RegularLayer).elements.includes(this)) {
      (this.layer as RegularLayer).removeElement(this, uow);
    }
  }

  transform(transforms: ReadonlyArray<Transform>, uow: UnitOfWork, isChild = false) {
    uow.snapshot(this);

    const previousBounds = this.bounds;
    this.setBounds(Transform.box(this.bounds, ...transforms), uow);

    this.getDefinition().onTransform(transforms, this, this.bounds, previousBounds, uow);

    if (this.parent && !isChild) {
      const parent = this.parent;
      if (isNode(parent)) {
        uow.registerOnCommitCallback('onChildChanged', parent, () => {
          parent.getDefinition().onChildChanged(parent, uow);
        });
      } else {
        assert.true(this.isLabelNode());

        // TODO: This should be possible to put in the invalidation() method

        if (uow.contains(this.labelEdge()!)) return;

        const labelNode = this.labelNode();
        assert.present(labelNode);

        const dx = this.bounds.x - previousBounds.x;
        const dy = this.bounds.y - previousBounds.y;

        const clampAmount = 100;

        this.updateLabelNode(
          {
            offset: {
              x: clamp(labelNode.offset.x + dx, -clampAmount, clampAmount),
              y: clamp(labelNode.offset.y + dy, -clampAmount, clampAmount)
            }
          },
          uow
        );
      }
    }

    uow.updateElement(this);
  }

  _removeEdge(anchor: string | undefined, edge: DiagramEdge) {
    this.#edges.set(anchor ?? '', this.#edges.get(anchor ?? '')?.filter(e => e !== edge.id) ?? []);
  }

  _addEdge(anchor: string | undefined, edge: DiagramEdge) {
    this.#edges.set(anchor ?? '', unique([...(this.#edges.get(anchor ?? '') ?? []), edge.id]));
  }

  _getAnchorPosition(anchor: string) {
    return this._getPositionInBounds(this.getAnchor(anchor).start);
  }

  _getPositionInBounds(p: Point) {
    return Point.rotateAround(
      {
        x: this.bounds.x + this.bounds.w * (this.renderProps.geometry.flipH ? 1 - p.x : p.x),
        y: this.bounds.y + this.bounds.h * (this.renderProps.geometry.flipV ? 1 - p.y : p.y)
      },
      this.bounds.r,
      Box.center(this.bounds)
    );
  }

  listEdges(): DiagramEdge[] {
    return [
      ...Array.from(this.#edges.values)
        .flatMap(e => e)
        .map(e => this.diagram.edgeLookup.get(e)!),
      ...this.children.flatMap(c => (isNode(c) ? c.listEdges() : []))
    ];
  }

  isLabelNode() {
    return this.parent !== undefined && isEdge(this.parent);
  }

  labelNode() {
    if (!this.isLabelNode()) return undefined;
    const edge = this.labelEdge();
    assert.present(edge);
    assert.present(edge.labelNodes);
    return edge.labelNodes.find(n => n.node() === this);
  }

  labelEdge(): DiagramEdge | undefined {
    if (!this.isLabelNode()) return undefined;
    const edge = this.parent;
    assert.present(edge);
    assert.edge(edge);
    return edge;
  }

  // TODO: Is this really needed - shouldn't this be part of DiagramEdge
  updateLabelNode(labelNode: Partial<LabelNode>, uow: UnitOfWork) {
    if (!this.isLabelNode()) return;

    uow.snapshot(this);

    const replacement: ResolvedLabelNode = {
      ...this.labelNode()!,
      ...labelNode,
      node: () => this
    };

    const edge = this.labelEdge();
    assert.present(edge);
    edge.setLabelNodes(
      edge.labelNodes!.map((n: ResolvedLabelNode) => (n.node() === this ? replacement : n)),
      uow
    );

    uow.updateElement(this);
  }

  invalidateAnchors(uow: UnitOfWork) {
    const def = this.diagram.document.nodeDefinitions.get(this.nodeType);
    this.#anchors.set(def.getAnchors(this));

    uow.updateElement(this);
  }

  private getNestedElements(): DiagramElement[] {
    return [this, ...this.children.flatMap(c => (isNode(c) ? c.getNestedElements() : c))];
  }

  getAttachmentsInUse() {
    return [this.renderProps.fill?.image?.id, this.renderProps.fill?.pattern];
  }
}
