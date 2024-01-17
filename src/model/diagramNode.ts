import { Box } from '../geometry/box.ts';
import { clamp, round } from '../utils/math.ts';
import { Transform } from '../geometry/transform.ts';
import { deepClone } from '../utils/clone.ts';
import { Diagram } from './diagram.ts';
import { DiagramEdge, ResolvedLabelNode } from './diagramEdge.ts';
import { AbstractNode, Anchor, LabelNode } from './types.ts';
import { Layer } from './diagramLayer.ts';
import { assert } from '../utils/assert.ts';
import { newid } from '../utils/id.ts';
import { UnitOfWork, UOWTrackable } from './unitOfWork.ts';
import { DiagramElement, isEdge, isNode } from './diagramElement.ts';
import { ConnectedEndpoint, Endpoint, FreeEndpoint, isConnected } from './endpoint.ts';
import { SerializedNode } from './serialization/types.ts';
import { DeepReadonly } from '../utils/types.ts';
import { PathUtils } from '../geometry/pathUtils.ts';

export type DiagramNodeSnapshot = Omit<SerializedNode, 'children'> & {
  _snapshotType: 'node';
  children: string[];
};

export type DuplicationContext = {
  targetElementsInGroup: Map<string, DiagramElement>;
};

export class DiagramNode
  implements AbstractNode, DiagramElement, UOWTrackable<DiagramNodeSnapshot>
{
  readonly type = 'node';

  readonly id: string;
  readonly edges: Map<number, DiagramEdge[]> = new Map<number, DiagramEdge[]>();

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
    props?: DeepReadonly<NodeProps>,
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
      this.invalidateAnchors(UnitOfWork.throwaway(diagram));
    }
  }

  getDefinition() {
    return this.diagram.nodeDefinitions.get(this.#nodeType);
  }

  get nodeType() {
    return this.#nodeType;
  }

  /* Props *************************************************************************************************** */

  get props(): DeepReadonly<NodeProps> {
    return this.#props;
  }

  updateProps(callback: (props: NodeProps) => void, uow: UnitOfWork) {
    uow.snapshot(this);
    callback(this.#props);
    uow.updateElement(this);
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

    this.#children = children;
    this.#children.forEach(c => c._setParent(this));

    this.#children.forEach(c => uow.updateElement(c));
    uow.updateElement(this);

    this.getDefinition().onChildChanged(this, uow);
  }

  addChild(child: DiagramElement, uow: UnitOfWork) {
    uow.snapshot(this);

    this.#children = [...this.children, child];
    child._setParent(this);

    uow.updateElement(this);
    uow.updateElement(child);

    this.getDefinition().onChildChanged(this, uow);
  }

  removeChild(child: DiagramElement, uow: UnitOfWork) {
    uow.snapshot(this);

    this.#children = this.children.filter(c => c !== child);
    child._setParent(undefined);

    uow.updateElement(this);
    uow.updateElement(child);

    this.getDefinition().onChildChanged(this, uow);
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
    if (this.#anchors === undefined) {
      UnitOfWork.execute(this.diagram, uow => {
        this.invalidateAnchors(uow);
      });
    }

    return this.#anchors ?? [];
  }

  getAnchor(anchor: number) {
    return this.anchors[anchor >= this.anchors.length ? 0 : anchor];
  }

  /* Snapshot ************************************************************************************************ */

  snapshot(): DiagramNodeSnapshot {
    return {
      _snapshotType: 'node',
      id: this.id,
      type: 'node',
      nodeType: this.nodeType,
      bounds: deepClone(this.bounds),
      props: deepClone(this.props),
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
    this.#props.highlight = undefined;
    this.setChildren(
      snapshot.children.map(c => this.diagram.lookup(c)!),
      uow
    );
    this.edges.clear();
    for (const [k, v] of Object.entries(snapshot.edges ?? {})) {
      this.edges.set(Number(k), [
        ...(this.edges.get(Number(k)) ?? []),
        ...v.map(e => this.diagram.edgeLookup.get(e.id)!)
      ]);
    }

    uow.updateElement(this);
  }

  convertToPath(uow: UnitOfWork) {
    const path = this.getDefinition().getBoundingPath(this);
    const scaledPath = PathUtils.scalePath(path, this.bounds, { x: -1, y: 1, w: 2, h: -2, r: 0 });

    this.#nodeType = 'generic-path';
    this.updateProps(p => {
      p.genericPath = {};
      p.genericPath.path = scaledPath.asSvgPath();
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
      deepClone(this.props) as NodeProps,
      this.#anchors
    );

    context.targetElementsInGroup.set(this.id, node);

    // Phase 1 - duplicate all elements in the group
    const newChildren: DiagramElement[] = [];
    for (const c of this.children) {
      const newElement = c.duplicate(context);
      newChildren.push(newElement);
    }
    node.setChildren(newChildren, new UnitOfWork(this.diagram));
    context.targetElementsInGroup.set(this.id, node);

    if (!isTopLevel) return node;

    // Phase 2 - update all edges to point to the new elements
    for (const e of node.getNestedElements()) {
      if (isEdge(e)) {
        let newStart: Endpoint;
        let newEnd: Endpoint;

        if (isConnected(e.start)) {
          const newStartNode = context.targetElementsInGroup.get(e.start.node.id);
          if (newStartNode) {
            newStart = new ConnectedEndpoint(e.start.anchor, newStartNode as DiagramNode);
          } else {
            newStart = new FreeEndpoint(e.start.position);
          }
        } else {
          newStart = new FreeEndpoint(e.start.position);
        }

        if (isConnected(e.end)) {
          const newEndNode = context.targetElementsInGroup.get(e.end.node.id);
          if (newEndNode) {
            newEnd = new ConnectedEndpoint(e.end.anchor, newEndNode as DiagramNode);
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

    this.invalidateAnchors(uow);

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
        if (isConnected(edge.start) && edge.start.node === this) {
          edge.setStart(new FreeEndpoint(edge.start.position), uow);
          isChanged = true;
        }
        if (isConnected(edge.end) && edge.end.node === this) {
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

    this.getDefinition().onTransform(transforms, this, uow);

    if (this.parent && !isChild) {
      const parent = this.parent;
      uow.pushAction('onChildChanged', parent, () => {
        parent.getDefinition().onChildChanged(parent, uow);
      });
    }

    // TODO: This should be possible to put in the invalidation() method
    if (this.isLabelNode() && !isChild) {
      uow.pushAction('updateLabelNode', this, () => {
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
      });
    }

    uow.updateElement(this);
  }

  _removeEdge(anchor: number, edge: DiagramEdge) {
    this.edges.set(anchor, this.edges.get(anchor)?.filter(e => e !== edge) ?? []);
  }

  _addEdge(anchor: number, edge: DiagramEdge) {
    this.edges.set(anchor, [...(this.edges.get(anchor) ?? []), edge]);
  }

  _getAnchorPosition(anchor: number) {
    return {
      x: this.bounds.x + this.bounds.w * this.getAnchor(anchor).point.x,
      y: this.bounds.y + this.bounds.h * this.getAnchor(anchor).point.y
    };
  }

  listEdges(): DiagramEdge[] {
    return [
      ...[...this.edges.values()].flatMap(e => e),
      ...this.children.flatMap(c => (isNode(c) ? c.listEdges() : []))
    ];
  }

  isLabelNode() {
    return !!this.props.labelForEdgeId;
  }

  labelNode() {
    if (!this.props.labelForEdgeId) return undefined;
    const edge = this.labelEdge();
    assert.present(edge);
    assert.present(edge.labelNodes);
    return edge.labelNodes.find(n => n.node === this);
  }

  labelEdge() {
    if (!this.props.labelForEdgeId) return undefined;
    const edge = this.diagram.edgeLookup.get(this.props.labelForEdgeId);
    assert.present(edge);
    return edge;
  }

  updateLabelNode(labelNode: Partial<LabelNode>, uow: UnitOfWork) {
    if (!this.props.labelForEdgeId) return;

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

  // TODO: Need to make sure this is called when e.g. props are changed
  // TODO: Delegate to NodeDefinition
  private invalidateAnchors(uow: UnitOfWork) {
    const newAnchors: Array<Anchor> = [];
    newAnchors.push({ point: { x: 0.5, y: 0.5 }, clip: true });

    const def = this.diagram.nodeDefinitions.get(this.nodeType);

    const path = def.getBoundingPath(this);

    for (const p of path.segments) {
      const { x, y } = p.point(0.5);
      const lx = round((x - this.bounds.x) / this.bounds.w);
      const ly = round((y - this.bounds.y) / this.bounds.h);

      newAnchors.push({ point: { x: lx, y: ly }, clip: false });
    }

    this.#anchors = newAnchors;

    uow.updateElement(this);
  }

  private getNestedElements(): DiagramElement[] {
    return [this, ...this.children.flatMap(c => (isNode(c) ? c.getNestedElements() : c))];
  }
}
