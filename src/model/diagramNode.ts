import { Box } from '../geometry/box.ts';
import { clamp, round } from '../utils/math.ts';
import { Transform } from '../geometry/transform.ts';
import { deepClone } from '../utils/clone.ts';
import { Diagram } from './diagram.ts';
import {
  ConnectedEndpoint,
  DiagramEdge,
  Endpoint,
  FreeEndpoint,
  isConnected
} from './diagramEdge.ts';
import { AbstractNode, Anchor } from './types.ts';
import { Layer } from './diagramLayer.ts';
import { assert } from '../utils/assert.ts';
import { newid } from '../utils/id.ts';
import { UnitOfWork } from './unitOfWork.ts';
import { DiagramElement, isEdge, isNode } from './diagramElement.ts';

export type DiagramNodeSnapshot = Pick<AbstractNode, 'id' | 'bounds' | 'props'>;

export type DuplicationContext = {
  targetElementsInGroup: Map<string, DiagramElement>;
};

export class DiagramNode implements AbstractNode, DiagramElement {
  readonly id: string;
  readonly type = 'node';
  readonly nodeType: 'group' | string;
  readonly edges: Map<number, DiagramEdge[]> = new Map<number, DiagramEdge[]>();

  bounds: Box;
  parent?: DiagramNode;
  props: NodeProps = {};
  diagram: Diagram;
  layer: Layer;

  #anchors?: ReadonlyArray<Anchor>;
  #children: ReadonlyArray<DiagramElement>;

  constructor(
    id: string,
    nodeType: 'group' | string,
    bounds: Box,
    diagram: Diagram,
    layer: Layer,
    props?: NodeProps,
    anchorCache?: ReadonlyArray<Anchor>
  ) {
    this.id = id;
    this.bounds = bounds;
    this.nodeType = nodeType;
    this.#children = [];
    this.diagram = diagram;
    this.layer = layer;

    this.props = props ?? {};
    this.#anchors = anchorCache;

    // Ensure all anchors are loaded without triggering a change event
    if (!this.#anchors) {
      this.invalidateAnchors(new UnitOfWork(diagram));
    }
  }

  set children(value: ReadonlyArray<DiagramElement>) {
    this.#children = value;
    this.#children.forEach(c => (c.parent = this));

    // TODO: Maybe this can be moved into invalidate() in case we have a way to capture the initial snapshot somehow
    UnitOfWork.execute(this.diagram, uow => {
      this.getNodeDefinition().onChildChanged(this, uow);
    });
  }

  get children() {
    return this.#children;
  }

  isLocked() {
    return this.layer.isLocked() ?? false;
  }

  updateCustomProps() {
    UnitOfWork.execute(this.diagram, uow => {
      // TODO: Maybe this can be moved into invalidate() in case we have a way to capture the initial snapshot somehow
      this.getNodeDefinition().onPropUpdate(this, uow);
    });
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
      this.parent.children = this.parent?.children.filter(c => c !== this);
    }
    this.parent = undefined;

    this.diagram.nodeLookup.delete(this.id);

    // "Detach" any edges that connects to this node
    for (const anchor of this.edges.keys()) {
      for (const edge of this.edges.get(anchor) ?? []) {
        let isChanged = false;
        if (isConnected(edge.start) && edge.start.node === this) {
          edge.start = { position: edge.start.position };
          isChanged = true;
        }
        if (isConnected(edge.end) && edge.end.node === this) {
          edge.end = { position: edge.end.position };
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
    const previousBounds = this.bounds;
    this.bounds = Transform.box(this.bounds, ...transforms);

    this.getNodeDefinition().onTransform(transforms, this, uow);

    if (this.parent && !isChild) {
      const parent = this.parent;
      uow.pushAction('onChildChanged', parent, () => {
        parent.getNodeDefinition().onChildChanged(parent, uow);
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
        labelNode.offset = {
          x: clamp(labelNode.offset.x + dx, -clampAmount, clampAmount),
          y: clamp(labelNode.offset.y + dy, -clampAmount, clampAmount)
        };

        uow.updateElement(this.labelEdge()!);
      });
    }

    uow.updateElement(this);
  }

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

  removeEdge(anchor: number, edge: DiagramEdge) {
    this.edges.set(anchor, this.edges.get(anchor)?.filter(e => e !== edge) ?? []);
  }

  addEdge(anchor: number, edge: DiagramEdge) {
    this.edges.set(anchor, [...(this.edges.get(anchor) ?? []), edge]);
  }

  getAnchorPosition(anchor: number) {
    return {
      x: this.bounds.x + this.bounds.w * this.getAnchor(anchor).point.x,
      y: this.bounds.y + this.bounds.h * this.getAnchor(anchor).point.y
    };
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
      deepClone(this.props),
      this.#anchors
    );

    context.targetElementsInGroup.set(this.id, node);

    // Phase 1 - duplicate all elements in the group
    const newChildren: DiagramElement[] = [];
    for (const c of this.children) {
      const newElement = c.duplicate(context);
      newChildren.push(newElement);
    }
    node.children = newChildren;
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

        e.start = newStart;
        e.end = newEnd;
      }
    }

    return node;
  }

  getNestedElements(): DiagramElement[] {
    return [this, ...this.children.flatMap(c => (isNode(c) ? c.getNestedElements() : c))];
  }

  snapshot() {
    return {
      id: this.id,
      bounds: deepClone(this.bounds),
      props: deepClone(this.props)
    };
  }

  restore(snapshot: DiagramNodeSnapshot, uow: UnitOfWork) {
    this.bounds = snapshot.bounds;
    this.props = snapshot.props;
    uow.updateElement(this);
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
    const edge = this.diagram.edgeLookup.get(this.props.labelForEdgeId);
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

  getNodeDefinition() {
    return this.diagram.nodeDefinitions.get(this.nodeType);
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
}
