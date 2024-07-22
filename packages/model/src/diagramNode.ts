import { AbstractNode, LabelNode } from './types';
import { Box } from '@diagram-craft/geometry/box';
import { Transform } from '@diagram-craft/geometry/transform';
import { DiagramElement, isEdge, isNode } from './diagramElement';
import { DiagramNodeSnapshot, UnitOfWork, UOWTrackable } from './unitOfWork';
import { DiagramEdge, ResolvedLabelNode } from './diagramEdge';
import { Diagram } from './diagram';
import { Layer } from './diagramLayer';
import { nodeDefaults } from './diagramDefaults';
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

export type DuplicationContext = {
  targetElementsInGroup: Map<string, DiagramElement>;
};

type OptionalKeys = 'labelForEdgeId';

export type NodePropsForRendering = DeepReadonly<
  DeepRequired<Omit<NodeProps, OptionalKeys>> & Pick<NodeProps, OptionalKeys>
>;
export type NodePropsForEditing = DeepReadonly<NodeProps>;

export class DiagramNode
  implements AbstractNode, DiagramElement, UOWTrackable<DiagramNodeSnapshot>
{
  readonly type = 'node';

  readonly id: string;
  readonly edges: Map<string | undefined, DiagramEdge[]> = new Map<
    string | undefined,
    DiagramEdge[]
  >();

  #cache: Map<string, unknown> | undefined = undefined;

  #nodeType: 'group' | string;
  #diagram: Diagram;
  #layer: Layer;
  #parent?: DiagramNode;

  #props: NodeProps = {};

  #bounds: Box;
  #anchors?: ReadonlyArray<Anchor>;
  #children: ReadonlyArray<DiagramElement>;

  constructor(
    id: string,
    nodeType: 'group' | string,
    bounds: Box,
    diagram: Diagram,
    layer: Layer,
    props?: NodePropsForEditing,
    anchorCache?: ReadonlyArray<Anchor>
  ) {
    this.id = id;
    this.#bounds = bounds;
    this.#nodeType = nodeType;
    this.#children = [];
    this.#diagram = diagram;
    this.#layer = layer;

    this.#props = (props ?? {}) as NodeProps;
    this.#anchors = anchorCache;

    if (!this.#anchors) {
      this.invalidateAnchors(UnitOfWork.immediate(diagram));
    }

    this.#props.style ??= this.nodeType === 'text' ? 'default-text' : 'default';
  }

  getDefinition() {
    return this.diagram.document.nodeDefinitions.get(this.#nodeType);
  }

  get nodeType() {
    return this.#nodeType;
  }

  get cache() {
    if (!this.#cache) {
      this.#cache = new Map<string, unknown>();
    }
    return this.#cache;
  }

  /* Highlights ********************************************************************************************** */

  #highlights: ReadonlyArray<string> = [];

  set highlights(highlights: ReadonlyArray<string>) {
    this.#highlights = highlights;
    this.diagram.emitAsync('elementHighlighted', { element: this });
  }

  get highlights() {
    return this.#highlights;
  }

  /* Props *************************************************************************************************** */

  private populatePropsCache() {
    const styleProps = this.diagram.document.styles.nodeStyles.find(
      s => s.id === this.#props.style
    )?.props;

    const propsForEditing = deepMerge({}, styleProps ?? {}, this.#props) as DeepRequired<NodeProps>;

    const propsForRendering = deepMerge({}, makeWriteable(nodeDefaults), propsForEditing);

    this.cache.set('props.forEditing', propsForEditing);
    this.cache.set('props.forRendering', propsForRendering);

    return {
      forEditing: propsForEditing,
      forRendering: propsForRendering
    };
  }

  get storedProps() {
    return this.#props;
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
    callback(this.#props);
    uow.updateElement(this);

    this.#cache?.clear();
    this.invalidateAnchors(uow);
    this.getDefinition().onPropUpdate(this, uow);
  }

  /* Name **************************************************************************************************** */

  get data() {
    if (this.isLabelNode()) return this.labelEdge()!.data;

    return this.renderProps.data?.customData ?? {};
  }

  get name() {
    if (this.#cache?.has('name')) return this.#cache.get('name') as string;

    if (!isEmptyString(this.#props.name)) {
      this.cache.set('name', this.#props.name!);
      return this.cache.get('name') as string;
    }

    if (this.#props.text?.text) {
      const metadata = this.data;

      if (this.#props.text.text[0] === '<') {
        try {
          const d = new DOMParser().parseFromString(this.#props.text.text, 'text/html');
          const text = d.body.textContent;
          if (text) {
            this.cache.set('name', applyTemplate(text, metadata));
            return text;
          }
        } catch (e) {
          // Ignore
        }
      }

      this.cache.set('name', applyTemplate(this.#props.text.text, metadata));
      return this.cache.get('name') as string;
    }
    return this.nodeType + ' / ' + this.id;
  }

  /* Diagram/layer ******************************************************************************************* */

  get diagram() {
    return this.#diagram;
  }

  get layer() {
    return this.#layer;
  }

  _setLayer(layer: Layer, diagram: Diagram) {
    this.#layer = layer;
    this.#diagram = diagram;
  }

  /* Parent ************************************************************************************************** */

  get parent() {
    return this.#parent;
  }

  _setParent(parent: DiagramNode | undefined) {
    this.#parent = parent;
  }

  /* Children *********************************************************************************************** */

  get children() {
    return this.#children;
  }

  setChildren(children: ReadonlyArray<DiagramElement>, uow: UnitOfWork) {
    uow.snapshot(this);

    const oldChildren = this.children;

    this.#children = children;
    this.#children.forEach(c => {
      uow.snapshot(c);
      c._setParent(this);
      if (isNode(c)) this.diagram.nodeLookup.set(c.id, c);
      else if (isEdge(c)) this.diagram.edgeLookup.set(c.id, c);
    });

    oldChildren.filter(c => !children.includes(c)).forEach(c => c._setParent(undefined));

    this.#children.forEach(c => uow.updateElement(c));
    uow.updateElement(this);

    // TODO: This should be wrapped in uow.pushAction
    //       ... however, deserialization doesn't ever commit there uow
    //       so the event is never triggered
    uow.pushAction('onChildChanged', this, () => {
      this.getDefinition().onChildChanged(this, uow);
    });
  }

  addChild(
    child: DiagramElement,
    uow: UnitOfWork,
    relation?: { ref: DiagramElement; type: 'after' | 'before' }
  ) {
    uow.snapshot(this);

    if (relation) {
      const children = this.children;
      const index = children.indexOf(relation.ref);
      if (relation.type === 'after') {
        this.#children = [...children.slice(0, index + 1), child, ...children.slice(index + 1)];
      } else {
        this.#children = [...children.slice(0, index), child, ...children.slice(index)];
      }
    } else {
      this.#children = [...this.children, child];
    }
    child._setParent(this);

    uow.updateElement(this);
    uow.updateElement(child);

    uow.pushAction('onChildChanged', this, () => {
      this.getDefinition().onChildChanged(this, uow);
    });
  }

  removeChild(child: DiagramElement, uow: UnitOfWork) {
    uow.snapshot(this);

    this.#children = this.children.filter(c => c !== child);
    child._setParent(undefined);

    uow.updateElement(this);
    uow.updateElement(child);

    uow.pushAction('onChildChanged', this, () => {
      this.getDefinition().onChildChanged(this, uow);
    });
  }

  /* Bounds ************************************************************************************************* */

  get bounds(): Box {
    return this.#bounds;
  }

  setBounds(bounds: Box, uow: UnitOfWork) {
    uow.snapshot(this);
    const oldBounds = this.bounds;
    this.#bounds = bounds;
    if (!Box.isEqual(oldBounds, this.bounds)) uow.updateElement(this);
  }

  isLocked() {
    return this.layer.isLocked();
  }

  /* Anchors ************************************************************************************************ */

  get anchors(): ReadonlyArray<Anchor> {
    // TODO: Can this be handled using cache
    if (this.#anchors === undefined) {
      UnitOfWork.execute(this.diagram, uow => {
        this.invalidateAnchors(uow);
      });
    }

    return this.#anchors ?? [];
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
      edges: this.edges
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
      props: deepClone(this.#props),
      children: this.children.map(c => c.id),
      edges: Object.fromEntries(
        [...this.edges.entries()].map(([k, v]) => [k, v.map(e => ({ id: e.id }))])
      )
    };
  }

  // TODO: Add assertions for lookups
  restore(snapshot: DiagramNodeSnapshot, uow: UnitOfWork) {
    this.setBounds(snapshot.bounds, uow);
    this.#props = snapshot.props as NodeProps;
    this.#highlights = [];
    this.#nodeType = snapshot.nodeType;

    this.setChildren(
      snapshot.children.map(c => {
        const el = this.diagram.lookup(c);
        if (!el) VERIFY_NOT_REACHED();
        return el!;
      }),
      uow
    );
    this.edges.clear();
    for (const [k, v] of Object.entries(snapshot.edges ?? {})) {
      this.edges.set(k, [
        ...(this.edges.get(k) ?? []),
        ...v.map(e => this.diagram.edgeLookup.get(e.id)!)
      ]);
    }

    uow.updateElement(this);
    this.#cache?.clear();
  }

  convertToPath(uow: UnitOfWork) {
    uow.snapshot(this);

    const paths = this.getDefinition().getBoundingPath(this);

    const scaledPath = paths.scale({ x: -1, y: 1, w: 2, h: -2, r: 0 }, this.bounds);

    this.#nodeType = 'generic-path';
    this.updateProps(p => {
      p.shapeGenericPath = {};
      p.shapeGenericPath.path = scaledPath.asSvgPath();
    }, uow);
  }

  duplicate(ctx?: DuplicationContext): DiagramNode {
    const isTopLevel = ctx === undefined;
    const context = ctx ?? {
      targetElementsInGroup: new Map()
    };

    // The node might already have been duplicated being a label node of one of the edges
    if (context.targetElementsInGroup.has(this.id)) {
      return context.targetElementsInGroup.get(this.id) as DiagramNode;
    }

    const node = new DiagramNode(
      newid(),
      this.nodeType,
      deepClone(this.bounds),
      this.diagram,
      this.layer,
      deepClone(this.#props) as NodeProps,
      this.#anchors
    );

    context.targetElementsInGroup.set(this.id, node);

    // Phase 1 - duplicate all elements in the group
    const newChildren: DiagramElement[] = [];
    for (const c of this.children) {
      const newElement = c.duplicate(context);
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
    // Update any parent
    if (this.parent) {
      this.parent.removeChild(this, uow);
    }

    this.diagram.nodeLookup.delete(this.id);

    // "Detach" any edges that connects to this node
    for (const anchor of this.edges.keys()) {
      for (const edge of this.edges.get(anchor) ?? []) {
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

    // Update edge for which this node is a label node
    if (this.isLabelNode()) {
      const edge = this.labelEdge()!;
      const labelNode = this.labelNode()!;
      edge.removeLabelNode(labelNode, uow);
      this.updateProps(p => {
        p.labelForEdgeId = undefined;
      }, uow);
    }

    // Note, need to check if the element is still in the layer to avoid infinite recursion
    if (this.layer.elements.includes(this)) {
      this.layer.removeElement(this, uow);
    }
  }

  transform(transforms: ReadonlyArray<Transform>, uow: UnitOfWork, isChild = false) {
    uow.snapshot(this);

    const previousBounds = this.bounds;
    this.setBounds(Transform.box(this.bounds, ...transforms), uow);

    this.getDefinition().onTransform(transforms, this, this.bounds, previousBounds, uow);

    if (this.parent && !isChild) {
      const parent = this.parent;
      uow.pushAction('onChildChanged', parent, () => {
        parent.getDefinition().onChildChanged(parent, uow);
      });
    }

    // TODO: This should be possible to put in the invalidation() method
    if (this.isLabelNode() && !isChild) {
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

    uow.updateElement(this);
  }

  _removeEdge(anchor: string | undefined, edge: DiagramEdge) {
    this.edges.set(anchor, this.edges.get(anchor)?.filter(e => e !== edge) ?? []);
  }

  _addEdge(anchor: string | undefined, edge: DiagramEdge) {
    this.edges.set(anchor, [...(this.edges.get(anchor) ?? []), edge]);
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
      ...[...this.edges.values()].flatMap(e => e),
      ...this.children.flatMap(c => (isNode(c) ? c.listEdges() : []))
    ];
  }

  isLabelNode() {
    return !!this.#props.labelForEdgeId;
  }

  labelNode() {
    if (!this.#props.labelForEdgeId) return undefined;
    const edge = this.labelEdge();
    assert.present(edge);
    assert.present(edge.labelNodes);
    return edge.labelNodes.find(n => n.node === this);
  }

  labelEdge() {
    if (!this.#props.labelForEdgeId) return undefined;
    const edge = this.diagram.edgeLookup.get(this.#props.labelForEdgeId);
    assert.present(edge);
    return edge;
  }

  updateLabelNode(labelNode: Partial<LabelNode>, uow: UnitOfWork) {
    if (!this.#props.labelForEdgeId) return;

    uow.snapshot(this);

    const replacement: ResolvedLabelNode = {
      ...this.labelNode()!,
      ...labelNode,
      node: this
    };

    const edge = this.labelEdge();
    assert.present(edge);
    edge.setLabelNodes(
      edge.labelNodes!.map((n: ResolvedLabelNode) => (n.node === this ? replacement : n)),
      uow
    );

    uow.updateElement(this);
  }

  private invalidateAnchors(uow: UnitOfWork) {
    const def = this.diagram.document.nodeDefinitions.get(this.nodeType);
    this.#anchors = def.getAnchors(this);

    uow.updateElement(this);
  }

  private getNestedElements(): DiagramElement[] {
    return [this, ...this.children.flatMap(c => (isNode(c) ? c.getNestedElements() : c))];
  }

  getAttachmentsInUse() {
    return [this.renderProps.fill?.image?.id, this.renderProps.fill?.pattern];
  }
}
