import { Box } from '@diagram-craft/geometry/box';
import { Transform } from '@diagram-craft/geometry/transform';
import {
  AbstractDiagramElement,
  DiagramElement,
  type DiagramElementCRDT,
  isEdge,
  isNode
} from './diagramElement';
import { DiagramNodeSnapshot, getRemoteUnitOfWork, UnitOfWork, UOWTrackable } from './unitOfWork';
import type { DiagramEdge, ResolvedLabelNode } from './diagramEdge';
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
import { assert, mustExist, VerifyNotReached } from '@diagram-craft/utils/assert';
import { newid } from '@diagram-craft/utils/id';
import { clamp } from '@diagram-craft/utils/math';
import { Point } from '@diagram-craft/geometry/point';
import { applyTemplate } from '@diagram-craft/utils/template';
import { isEmptyString } from '@diagram-craft/utils/strings';
import { Anchor } from './anchor';
import { DynamicAccessor, PropPath, PropPathValue } from '@diagram-craft/utils/propertyPath';
import { toUnitLCS } from '@diagram-craft/geometry/pathListBuilder';
import type { RegularLayer } from './diagramLayerRegular';
import { transformPathList } from '@diagram-craft/geometry/pathListUtils';
import { WatchableValue } from '@diagram-craft/utils/watchableValue';
import { unique } from '@diagram-craft/utils/array';
import type { ModificationLayer } from './diagramLayerModification';
import { getAdjustments } from './diagramLayerUtils';
import type { NodeDefinition } from './elementDefinitionRegistry';
import type { PropertyInfo } from './property';
import {
  MappedCRDTMap,
  type MappedCRDTMapMapType
} from '@diagram-craft/collaboration/datatypes/mapped/mappedCrdtMap';
import type { CRDTMap, FlatCRDTMap } from '@diagram-craft/collaboration/crdt';
import type { CRDTMapper } from '@diagram-craft/collaboration/datatypes/mapped/types';
import { CRDTProp } from '@diagram-craft/collaboration/datatypes/crdtProp';
import { MappedCRDTProp } from '@diagram-craft/collaboration/datatypes/mapped/mappedCrdtProp';
import { CRDTObject } from '@diagram-craft/collaboration/datatypes/crdtObject';
import type { LabelNode } from './labelNode';
import { EffectsRegistry } from './effect';
import type { CustomNodeProps, EdgeProps, ElementMetadata, NodeProps } from './diagramProps';
import type { FlatObject } from '@diagram-craft/utils/flatObject';

export type DuplicationContext = {
  targetElementsInGroup: Map<string, DiagramElement>;
};

export type NodePropsForRendering = DeepReadonly<DeepRequired<NodeProps>>;
export type NodePropsForEditing = DeepReadonly<NodeProps>;

export type NodeTexts = { text: string } & Record<string, string>;

export type DiagramNodeCRDT = DiagramElementCRDT & {
  nodeType: string;
  bounds: Box;
  text: FlatCRDTMap;
  props: FlatCRDTMap;
  anchors: ReadonlyArray<Anchor> | undefined;
  edges: CRDTMap<MappedCRDTMapMapType<{ edges: Array<string> }>>;
};

const makeEdgesMapper = (
  node: DiagramNode
): CRDTMapper<string[], CRDTMap<{ edges: Array<string> }>> => {
  return {
    fromCRDT: (e: CRDTMap<{ edges: Array<string> }>) => e.get('edges')!,

    toCRDT: (e: string[]): CRDTMap<{ edges: Array<string> }> =>
      node.crdt.get().factory.makeMap<{ edges: Array<string> }>({
        edges: e
      })
  };
};

const DEFAULT_BOUNDS = { x: 0, y: 0, w: 10, h: 10, r: 0 };

/**
 * Shared implementation for transforming a node.
 * Used by both SimpleDiagramNode and DelegatingDiagramNode to avoid duplication.
 */
export const applyNodeTransform = (
  node: DiagramNode,
  transforms: ReadonlyArray<Transform>,
  uow: UnitOfWork,
  isChild = false
): void => {
  uow.snapshot(node);

  const previousBounds = node.bounds;
  node.setBounds(Transform.box(node.bounds, ...transforms), uow);

  node.getDefinition().onTransform(transforms, node, node.bounds, previousBounds, uow);

  if (node.parent && !isChild) {
    const parent = node.parent;
    if (isNode(parent)) {
      uow.registerOnCommitCallback('onChildChanged', parent, () => {
        parent.getDefinition().onChildChanged(parent, uow);
      });
    } else {
      assert.true(node.isLabelNode());

      // TODO: This should be possible to put in the invalidation() method

      if (uow.contains(node.labelEdge()!)) return;

      const labelNode = node.labelNode();
      assert.present(labelNode);

      const dx = node.bounds.x - previousBounds.x;
      const dy = node.bounds.y - previousBounds.y;

      const clampAmount = 100;

      node.updateLabelNode(
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

  uow.updateElement(node);
};

export interface DiagramNode extends DiagramElement {
  getDefinition(): NodeDefinition;
  get nodeType(): string;
  changeNodeType(nodeType: string, uow: UnitOfWork): void;
  getText(id?: string): string;
  setText(text: string, uow: UnitOfWork, id?: string): void;
  readonly texts: NodeTexts;
  getPropsInfo<T extends PropPath<NodeProps>>(
    path: T,
    defaultValue?: PropPathValue<NodeProps, T>
  ): PropertyInfo<PropPathValue<NodeProps, T>>;

  readonly storedProps: NodeProps;
  readonly editProps: NodePropsForEditing;
  readonly renderProps: NodePropsForRendering;
  updateProps(callback: (props: NodeProps) => void, uow: UnitOfWork): void;
  updateCustomProps<K extends keyof CustomNodeProps>(
    key: K,
    callback: (props: NonNullable<CustomNodeProps[K]>) => void,
    uow: UnitOfWork
  ): void;
  readonly dataForTemplate: FlatObject;
  readonly name: string;
  convertToPath(uow: UnitOfWork): void;

  _removeEdge(anchor: string | undefined, edge: DiagramEdge): void;
  _addEdge(anchor: string | undefined, edge: DiagramEdge): void;
  _getAnchorPosition(anchor: string): Point;
  _getPositionInBounds(p: Point, respectRotation?: boolean): Point;

  readonly edges: ReadonlyArray<DiagramEdge>;
  isLabelNode(): boolean;
  labelNode(): ResolvedLabelNode | undefined;
  labelEdge(): DiagramEdge | undefined;
  updateLabelNode(labelNode: Partial<LabelNode>, uow: UnitOfWork): void;
  invalidateAnchors(uow: UnitOfWork): void;

  get anchors(): ReadonlyArray<Anchor>;
  getAnchor(anchor: string): Anchor;
  duplicate(ctx?: DuplicationContext, id?: string): DiagramNode;

  _populatePropsCache(): void;

  _getNestedElements(): DiagramElement[];
}

export class SimpleDiagramNode extends AbstractDiagramElement implements DiagramNode, UOWTrackable {
  // Shared properties
  readonly #nodeType: CRDTProp<DiagramNodeCRDT, 'nodeType'>;
  readonly #edges: MappedCRDTMap<string[], { edges: Array<string> }>;

  // Note, we use MappedCRDTProp here for performance reasons
  readonly #bounds: MappedCRDTProp<DiagramNodeCRDT, 'bounds', Box>;
  readonly #text: CRDTObject<NodeTexts>;
  readonly #props: CRDTObject<NodeProps>;
  readonly #anchors: CRDTProp<DiagramNodeCRDT, 'anchors'>;

  protected constructor(
    id: string,
    layer: RegularLayer | ModificationLayer,
    anchorCache?: ReadonlyArray<Anchor>,
    crdt?: CRDTMap<DiagramElementCRDT>
  ) {
    super('node', id, layer, crdt);

    const nodeCrdt = this._crdt as unknown as WatchableValue<CRDTMap<DiagramNodeCRDT>>;

    this.#edges = new MappedCRDTMap(
      WatchableValue.from(
        ([m]) => m.get().get('edges', () => layer.diagram.document.root.factory.makeMap())!,
        [nodeCrdt]
      ),
      makeEdgesMapper(this),
      {
        onRemoteChange: () => getRemoteUnitOfWork(this.diagram).updateElement(this),
        onRemoteAdd: () => getRemoteUnitOfWork(this.diagram).updateElement(this),
        onRemoteRemove: () => getRemoteUnitOfWork(this.diagram).updateElement(this)
      }
    );

    this.#nodeType = new CRDTProp<DiagramNodeCRDT, 'nodeType'>(nodeCrdt, 'nodeType', {
      onRemoteChange: () => {
        this._children.clear();
        getRemoteUnitOfWork(this.diagram).updateElement(this);

        this.clearCache();

        UnitOfWork.executeSilently(this.diagram, uow => {
          this.invalidateAnchors(uow);
          this.getDefinition().onPropUpdate(this, uow);
        });
      }
    });
    this.#nodeType.init('rect');

    const textMap = WatchableValue.from(
      ([parent]) => parent.get().get('text', () => layer.crdt.factory.makeMap())!,
      [nodeCrdt] as const
    );
    this.#text = new CRDTObject<NodeTexts>(textMap, () => {
      getRemoteUnitOfWork(this.diagram).updateElement(this);
      this.clearCache();
    });
    this.#text.init({ text: '' });

    const propsMap = WatchableValue.from(
      ([parent]) => parent.get().get('props', () => layer.crdt.factory.makeMap())!,
      [nodeCrdt] as const
    );
    this.#props = new CRDTObject<NodeProps>(propsMap, () => {
      getRemoteUnitOfWork(this.diagram).updateElement(this);
      this.clearCache();
    });

    this.#anchors = new CRDTProp<DiagramNodeCRDT, 'anchors'>(nodeCrdt, 'anchors', {
      onRemoteChange: () => {
        getRemoteUnitOfWork(this.diagram).updateElement(this);
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
        onRemoteChange: () => getRemoteUnitOfWork(this.diagram).updateElement(this)
      }
    );
    this.#bounds.init(DEFAULT_BOUNDS);

    // Note: It is important that this comes last, as it might trigger
    //       events etc - so important that everything is set up before
    //       that to avoid flashing of incorrect formatting/style
    if (this.#anchors.get() === undefined) {
      UnitOfWork.executeSilently(this.diagram, uow => this.invalidateAnchors(uow));
    }
  }

  /* Factory ************************************************************************************************* */

  static _createEmpty(
    id: string,
    layer: RegularLayer | ModificationLayer,
    crdt?: CRDTMap<DiagramElementCRDT>
  ): DiagramNode {
    return new SimpleDiagramNode(id, layer, undefined, crdt);
  }

  static _create(
    id: string,
    nodeType: 'group' | string,
    bounds: Box,
    layer: RegularLayer | ModificationLayer,
    props: NodePropsForEditing,
    metadata: ElementMetadata,
    text: NodeTexts = { text: '' },
    anchorCache?: ReadonlyArray<Anchor>
  ) {
    const node = new SimpleDiagramNode(id, layer, anchorCache);

    SimpleDiagramNode.initializeNode(node, nodeType, bounds, props, metadata, text);

    return node;
  }

  protected static initializeNode(
    node: SimpleDiagramNode,
    nodeType: 'group' | string,
    bounds: Box,
    props: NodePropsForEditing,
    metadata: ElementMetadata,
    text: NodeTexts = { text: '' }
  ) {
    node.#bounds.set(bounds);
    node.#nodeType.set(nodeType);
    node.#text.set(text);

    node.#props.set(props as NodeProps);

    metadata.style ??= nodeType === 'text' ? DefaultStyles.node.text : DefaultStyles.node.default;
    metadata.textStyle ??= DefaultStyles.text.default;
    node._metadata.set(metadata);

    node.clearCache();
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

    this.clearCache();
    this.invalidateAnchors(uow);
    this.getDefinition().onPropUpdate(this, uow);
  }

  /* Text **************************************************************************************************** */

  getText(id = 'text') {
    return this.#text.get()[id === '1' ? 'text' : id]!;
  }

  setText(text: string, uow: UnitOfWork, id = 'text') {
    uow.snapshot(this);
    this.#text.set({
      ...this.#text.get(),
      [id === '1' ? 'text' : id]: text
    });
    uow.updateElement(this);
    this.clearCache();
  }

  get texts() {
    return this.#text.get();
  }

  /* Props *************************************************************************************************** */

  getPropsInfo<T extends PropPath<NodeProps>>(
    path: T,
    defaultValue?: PropPathValue<NodeProps, T>
  ): PropertyInfo<PropPathValue<NodeProps, T>> {
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

    if (defaultValue !== undefined) {
      dest.push({
        val: defaultValue,
        type: 'default'
      });
    } else {
      dest.push({
        val: nodeDefaults.get(path) as PropPathValue<NodeProps, T>,
        type: 'default'
      });
    }

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
      val: accessor.get(this.#props.get() as NodeProps, path) as PropPathValue<NodeProps, T>,
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
      this._parent.get() && this.#props.get().capabilities?.inheritStyle
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
    const ruleStyleProps = this.diagram.document.styles.getNodeStyle(ruleElementStyle)?.props;

    const ruleTextStyle = adjustments
      .map(([, v]) => v.textStyle)
      .filter(e => !!e)
      .at(-1);
    const ruleTextStyleProps = this.diagram.document.styles.getTextStyle(ruleTextStyle)?.props;

    return {
      parentProps,
      styleProps,
      textStyleProps,
      ruleProps: ruleProps as [string, NodeProps][],
      ruleStyleProps,
      ruleTextStyleProps
    };
  }

  _populatePropsCache() {
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
        child._populatePropsCache();
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

  get editProps(): NodePropsForEditing {
    return (this.cache.get('props.forEditing') ??
      this._populatePropsCache().forEditing) as NodePropsForEditing;
  }

  get renderProps(): NodePropsForRendering {
    return (this.cache.get('props.forRendering') ??
      this._populatePropsCache().forRendering) as NodePropsForRendering;
  }

  updateProps(callback: (props: NodeProps) => void, uow: UnitOfWork) {
    this.crdt.get().transact(() => {
      uow.snapshot(this);
      this.#props.update(callback);
      uow.updateElement(this);

      this.clearCache();
      this.invalidateAnchors(uow);
      this.getDefinition().onPropUpdate(this, uow);

      const parent = this.parent;
      if (isNode(parent)) {
        uow.registerOnCommitCallback('onChildChanged', parent, () => {
          parent.getDefinition().onChildChanged(parent, uow);
        });
      }
    });
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
    if (this.cache.has('name')) return this.cache.get('name') as string;

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
        } catch (_e) {
          // Ignore
        }
      }

      this.cache.set('name', applyTemplate(text, metadata));
      return this.cache.get('name') as string;
    }
    return `${this.nodeType} / ${this.id}`;
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
    return this.anchors.find(a => a.id === anchor) ?? this.anchors[0]!;
  }

  /* Snapshot ************************************************************************************************ */

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

  restore(snapshot: DiagramNodeSnapshot, uow: UnitOfWork) {
    this.setBounds(snapshot.bounds, uow);
    this.#props.set(snapshot.props as NodeProps);
    this.#nodeType.set(snapshot.nodeType);
    this.#text.set(snapshot.texts);
    this.forceUpdateMetadata(snapshot.metadata);

    this.setChildren(
      snapshot.children.map(c => mustExist(this.diagram.lookup(c))),
      uow
    );
    const edges = snapshot.edges ?? {};
    for (const [k, v] of Object.entries(edges)) {
      this.#edges.set(k, unique([...(this.#edges.get(k) ?? []), ...v.map(e => e.id)]));
    }

    uow.updateElement(this);
    this.clearCache();
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

      p.anchors ??= { type: 'per-path' };
      p.anchors.type = 'per-path';
      p.anchors.perPathCount = 10;
    }, uow);
  }

  duplicate(ctx?: DuplicationContext, id?: string): DiagramNode {
    const isTopLevel = ctx === undefined;
    const context = ctx ?? {
      targetElementsInGroup: new Map()
    };

    // The node might already have been duplicated being a label node of one of the edges
    if (context.targetElementsInGroup.has(this.id)) {
      return context.targetElementsInGroup.get(this.id) as DiagramNode;
    }

    const node = SimpleDiagramNode._create(
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
      const c = this.children[i]!;
      const newElement = c.duplicate(context, id ? `${id}-${i}` : undefined);
      newChildren.push(newElement);
    }
    UnitOfWork.executeSilently(this.diagram, uow => node.setChildren(newChildren, uow));
    context.targetElementsInGroup.set(this.id, node);

    if (!isTopLevel) return node;

    // Phase 2 - update all edges to point to the new elements
    for (const e of node._getNestedElements()) {
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

        UnitOfWork.executeSilently(this.diagram, uow => {
          e.setStart(newStart, uow);
          e.setEnd(newEnd, uow);
        });
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
    for (const edge of this.edges) {
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
    if (this.layer.elements.includes(this)) {
      this.layer.removeElement(this, uow);
    }
  }

  transform(transforms: ReadonlyArray<Transform>, uow: UnitOfWork, isChild = false): void {
    applyNodeTransform(this, transforms, uow, isChild);
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

  _getPositionInBounds(p: Point, respectRotation = true) {
    let bounds = this.bounds;
    if (this.renderProps.routing.spacing > 0) {
      bounds = Box.grow(bounds, this.renderProps.routing.spacing);
    }
    const point = {
      x: bounds.x + bounds.w * (this.renderProps.geometry.flipH ? 1 - p.x : p.x),
      y: bounds.y + bounds.h * (this.renderProps.geometry.flipV ? 1 - p.y : p.y)
    };

    let adjustedPoint = point;
    for (const e of EffectsRegistry.all()) {
      if (e.isUsedForNode(this.renderProps) && e.transformPoint) {
        adjustedPoint = e.transformPoint(this.bounds, this.renderProps, point);
      }
    }

    return respectRotation
      ? Point.rotateAround(adjustedPoint, bounds.r, Box.center(bounds))
      : adjustedPoint;
  }

  get edges(): DiagramEdge[] {
    return [
      ...Array.from(this.#edges.values)
        .flat()
        .map(e => this.diagram.edgeLookup.get(e)!),
      ...this.children.flatMap(c => (isNode(c) ? c.edges : []))
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
      edge.labelNodes.map((n: ResolvedLabelNode) => (n.node() === this ? replacement : n)),
      uow
    );

    uow.updateElement(this);
  }

  invalidateAnchors(uow: UnitOfWork) {
    const def = this.diagram.document.nodeDefinitions.get(this.nodeType);
    this.#anchors.set(def.getAnchors(this));

    uow.updateElement(this);
  }

  getAttachmentsInUse() {
    return [this.renderProps.fill.image.id, this.renderProps.fill.pattern];
  }

  _getNestedElements(): DiagramElement[] {
    return [this, ...this.children.flatMap(c => (isNode(c) ? c._getNestedElements() : c))];
  }
}
