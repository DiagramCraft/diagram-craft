import { Box } from '../geometry/box.ts';
import { clamp, round } from '../utils/math.ts';
import { Transform } from '../geometry/transform.ts';
import { deepClone } from '../utils/clone.ts';
import { Diagram, UnitOfWork } from './diagram.ts';
import { DiagramEdge, Endpoint, isConnected } from './diagramEdge.ts';
import { AbstractNode, Anchor } from './types.ts';
import { Layer } from './diagramLayer.ts';
import { assert } from '../utils/assert.ts';
import { newid } from '../utils/id.ts';

export type DiagramNodeSnapshot = Pick<AbstractNode, 'id' | 'bounds' | 'props'>;

export type DiagramElement = DiagramNode | DiagramEdge;

export type DuplicationContext = {
  targetElementsInGroup: Map<string, DiagramElement>;
};

export const getDiagramElementPath = (element: DiagramElement): DiagramNode[] => {
  const dest: DiagramNode[] = [];
  let current: DiagramNode | undefined = element.parent;
  while (current !== undefined) {
    dest.push(current);
    current = current.parent;
  }
  return dest;
};

export class DiagramNode implements AbstractNode {
  id: string;
  bounds: Box;
  type: 'node';
  nodeType: 'group' | string;
  parent?: DiagramNode;
  #children: Readonly<DiagramElement[]>;
  edges: Record<number, DiagramEdge[]>;
  props: NodeProps = {};
  diagram: Diagram;
  layer: Layer;

  #anchors?: Anchor[];

  constructor(
    id: string,
    nodeType: 'group' | string,
    bounds: Box,
    diagram: Diagram,
    layer: Layer,
    props?: NodeProps,
    anchorCache?: Anchor[]
  ) {
    this.id = id;
    this.bounds = bounds;
    this.type = 'node';
    this.nodeType = nodeType;
    this.#children = [];
    this.edges = {};
    this.diagram = diagram;
    this.layer = layer;

    this.props = props ?? {};
    this.#anchors = anchorCache;
  }

  set children(value: Readonly<DiagramElement[]>) {
    this.#children = value;
    this.recalculateBounds();
  }

  get children(): Readonly<DiagramElement[]> {
    return this.#children;
  }

  isLocked() {
    return this.layer.isLocked() ?? false;
  }

  updateCustomProps() {
    this.invalidateAnchors();
    this.diagram.updateElement(this);
  }

  transform(transforms: Transform[], uow: UnitOfWork, isChild = false) {
    const previousBounds = this.bounds;
    this.bounds = Transform.box(this.bounds, ...transforms);

    if (this.nodeType === 'group') {
      for (const child of this.children) {
        child.transform(transforms, uow, true);
      }
    }

    if (this.parent && !isChild) {
      const parent = this.parent;
      uow.pushAction('recalculateBounds', parent, () => {
        parent.recalculateBounds();
      });
    }

    if (this.isLabelNode() && !isChild) {
      const dx = this.bounds.pos.x - previousBounds.pos.x;
      const dy = this.bounds.pos.y - previousBounds.pos.y;

      const labelNode = this.labelNode();
      assert.present(labelNode);

      const clampAmount = 100;
      labelNode.offset = {
        x: clamp(labelNode.offset.x + dx, -clampAmount, clampAmount),
        y: clamp(labelNode.offset.y + dy, -clampAmount, clampAmount)
      };

      uow.updateElement(this.labelEdge()!);
    }

    uow.pushAction('updateAnchors', this, () => {
      this.invalidateAnchors();
    });
    uow.updateElement(this);
  }

  get anchors(): Anchor[] {
    if (this.#anchors === undefined) {
      this.invalidateAnchors();
      this.diagram.updateElement(this);
    }

    return this.#anchors ?? [];
  }

  getAnchor(anchor: number) {
    return this.anchors[anchor >= this.anchors.length ? 0 : anchor];
  }

  removeEdge(edge: DiagramEdge) {
    for (const [anchor, edges] of Object.entries(this.edges)) {
      this.edges[anchor as unknown as number] = edges.filter(e => e !== edge);
    }
  }

  addEdge(anchor: number, edge: DiagramEdge) {
    this.edges[anchor] = [...(this.edges[anchor] ?? []), edge];
  }

  updateEdge(anchor: number, edge: DiagramEdge) {
    if (this.edges[anchor]?.includes(edge)) return;

    this.removeEdge(edge);
    this.addEdge(anchor, edge);
  }

  getAnchorPosition(anchor: number) {
    return {
      x: this.bounds.pos.x + this.bounds.size.w * this.getAnchor(anchor).point.x,
      y: this.bounds.pos.y + this.bounds.size.h * this.getAnchor(anchor).point.y
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
      newElement.parent = node;
    }
    node.children = newChildren;
    context.targetElementsInGroup.set(this.id, node);

    if (!isTopLevel) return node;

    // Phase 2 - update all edges to point to the new elements
    for (const e of node.getNestedElements()) {
      if (e.type === 'edge') {
        let newStart: Endpoint;
        let newEnd: Endpoint;

        if (isConnected(e.start)) {
          const newStartNode = context.targetElementsInGroup.get(e.start.node.id);
          if (newStartNode) {
            newStart = { anchor: e.start.anchor, node: newStartNode as DiagramNode };
          } else {
            newStart = { position: e.startPosition };
          }
        } else {
          newStart = { position: e.startPosition };
        }

        if (isConnected(e.end)) {
          const newEndNode = context.targetElementsInGroup.get(e.end.node.id);
          if (newEndNode) {
            newEnd = { anchor: e.end.anchor, node: newEndNode as DiagramNode };
          } else {
            newEnd = { position: e.endPosition };
          }
        } else {
          newEnd = { position: e.endPosition };
        }

        e.start = newStart;
        e.end = newEnd;
      }
    }

    return node;
  }

  getNestedElements(): DiagramElement[] {
    return [this, ...this.children.flatMap(c => (c.type === 'node' ? c.getNestedElements() : c))];
  }

  snapshot() {
    return {
      id: this.id,
      bounds: deepClone(this.bounds),
      props: deepClone(this.props)
    };
  }

  restore(snapshot: DiagramNodeSnapshot) {
    this.id = snapshot.id;
    this.bounds = snapshot.bounds;
    this.props = snapshot.props;
  }

  // TODO: Refactor this to be a bit more readable
  listEdges(includeChildren = true): DiagramEdge[] {
    return [
      ...Object.values(this.edges ?? {}).flatMap(e => e),
      ...(includeChildren
        ? this.children.flatMap(c => (c.type === 'node' ? c.listEdges(includeChildren) : []))
        : [])
    ];
  }

  isLabelNode() {
    return !!this.props.labelForEgdeId;
  }

  labelNode() {
    if (!this.props.labelForEgdeId) return undefined;
    const edge = this.diagram.edgeLookup[this.props.labelForEgdeId];
    assert.present(edge);
    assert.present(edge.labelNodes);
    return edge.labelNodes.find(n => n.node === this);
  }

  labelEdge() {
    if (!this.props.labelForEgdeId) return undefined;
    const edge = this.diagram.edgeLookup[this.props.labelForEgdeId];
    assert.present(edge);
    return edge;
  }

  private recalculateBounds() {
    const childrenBounds = this.children.map(c => c.bounds);
    if (childrenBounds.length === 0) return;
    const newBounds = Box.boundingBox(childrenBounds);
    this.bounds = newBounds;
    if (!Box.isEqual(newBounds, this.bounds)) {
      this.diagram.updateElement(this);
    }
    this.parent?.recalculateBounds();
  }

  // TODO: Need to make sure this is called when e.g. props are changed
  private invalidateAnchors() {
    this.#anchors = [];
    this.#anchors.push({ point: { x: 0.5, y: 0.5 }, clip: true });

    const def = this.diagram.nodeDefinitions.get(this.nodeType);

    const path = def.getBoundingPath(this);

    for (const p of path.segments) {
      const { x, y } = p.point(0.5);
      const lx = round((x - this.bounds.pos.x) / this.bounds.size.w);
      const ly = round((y - this.bounds.pos.y) / this.bounds.size.h);

      this.#anchors.push({ point: { x: lx, y: ly }, clip: false });
    }
  }
}
