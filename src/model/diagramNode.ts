import { Box } from '../geometry/box.ts';
import { clamp, round } from '../utils/math.ts';
import { Transform } from '../geometry/transform.ts';
import { deepClone } from '../utils/clone.ts';
import { Diagram, UnitOfWork } from './diagram.ts';
import { DiagramEdge } from './diagramEdge.ts';
import { AbstractNode, Anchor } from './types.ts';
import { Layer } from './diagramLayer.ts';
import { assert } from '../utils/assert.ts';

export type DiagramNodeSnapshot = Pick<AbstractNode, 'id' | 'bounds' | 'props'>;

export type DiagramElement = DiagramNode | DiagramEdge;

export class DiagramNode implements AbstractNode {
  id: string;
  bounds: Box;
  type: 'node';
  nodeType: 'group' | string;

  parent?: DiagramNode;
  children: DiagramElement[];

  edges: Record<number, DiagramEdge[]>;

  props: NodeProps = {};

  _anchors?: Anchor[];

  diagram: Diagram;
  layer: Layer;

  constructor(
    id: string,
    nodeType: 'group' | string,
    bounds: Box,
    // TODO: Why do we need to initialize anchors here?
    anchors: Anchor[] | undefined,
    props: NodeProps,
    diagram: Diagram,
    layer: Layer
  ) {
    this.id = id;
    this.bounds = bounds;
    this.type = 'node';
    this.nodeType = nodeType;
    this.children = [];
    this.edges = {};
    this._anchors = anchors;
    this.props = props ?? {};
    this.diagram = diagram;
    this.layer = layer;
  }

  getTopmostParent(): DiagramNode {
    if (this.parent === undefined) return this;

    // TODO: Eliminate recursion
    return this.parent.getTopmostParent();
  }

  isLocked() {
    return this.layer.isLocked() ?? false;
  }

  updateCustomProps() {
    this.invalidateAnchors();
    this.diagram.updateElement(this);
  }

  transform(transforms: Transform[], uow: UnitOfWork) {
    const previousBounds = this.bounds;
    this.bounds = Transform.box(this.bounds, ...transforms);

    if (this.nodeType === 'group') {
      for (const child of this.children) {
        child.transform(transforms, uow);
      }
    }

    if (this.parent) {
      const parent = this.parent;
      uow.pushAction('recalculateBounds', parent, () => {
        parent.recalculateBounds();
      });
    }

    if (this.isLabelNode()) {
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
    if (this._anchors === undefined) {
      this.invalidateAnchors();
      this.diagram.updateElement(this);
    }

    return this._anchors ?? [];
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

  getAnchor(anchor: number) {
    return this.anchors[anchor >= this.anchors.length ? 0 : anchor];
  }

  duplicate() {
    const node = new DiagramNode(
      this.id,
      this.nodeType,
      deepClone(this.bounds),
      this._anchors ? [...this._anchors] : undefined,
      {},
      this.diagram,
      this.layer
    );
    node.props = deepClone(this.props);

    const newChildren: DiagramElement[] = [];
    for (const c of this.children) {
      if (c.type === 'node') {
        newChildren.push(c.duplicate());
      } else {
        // TODO: Implement this part
      }
    }
    node.children = newChildren;

    return node;
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

  // TODO: We should make this private, and trigger from assigning to children
  //       ... also need to make children readonly
  recalculateBounds() {
    const childrenBounds = this.children.map(c => c.bounds);
    this.bounds = Box.boundingBox(childrenBounds);
  }

  // TODO: Need to make sure this is called when e.g. props are changed
  private invalidateAnchors() {
    this._anchors = [];
    this._anchors.push({ point: { x: 0.5, y: 0.5 }, clip: true });

    const def = this.diagram.nodeDefinitions.get(this.nodeType);

    const path = def.getBoundingPath(this);

    for (const p of path.segments) {
      const { x, y } = p.point(0.5);
      const lx = round((x - this.bounds.pos.x) / this.bounds.size.w);
      const ly = round((y - this.bounds.pos.y) / this.bounds.size.h);

      this._anchors.push({ point: { x: lx, y: ly }, clip: false });
    }
  }
}
