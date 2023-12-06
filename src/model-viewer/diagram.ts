import { EventEmitter } from '../utils/event.ts';
import { VERIFY_NOT_REACHED } from '../utils/assert.ts';
import { Transform } from '../geometry/transform.ts';
import { Box } from '../geometry/box.ts';
import { UndoManager } from '../model-editor/undoManager.ts';
import { Viewbox } from './viewBox.ts';
import { deepClone } from '../utils/clone.ts';
import { Point } from '../geometry/point.ts';
import { round } from '../utils/math.ts';
import { assert } from '../utils/assert.ts';
import { Path } from '../geometry/path.ts';

declare global {
  interface ElementProps {
    stroke?: {
      color?: string;
      width?: number;
      pattern?: string;
      patternSpacing?: number;
      patternSize?: number;
    };
    text?: {
      text?: string;
      font?: string;
      fontSize?: number;
      bold?: boolean;
      italic?: boolean;
      textDecoration?: 'underline' | 'line-through' | 'overline';
      textTransform?: 'uppercase' | 'lowercase' | 'capitalize';
      color?: string;
      align?: 'left' | 'center' | 'right';
      valign?: 'top' | 'middle' | 'bottom';
      top?: number;
      left?: number;
      right?: number;
      bottom?: number;
    };
  }

  interface EdgeProps extends ElementProps {
    highlight?: string[];
    type?: 'straight' | 'bezier' | 'curved' | 'orthogonal';
    arrow?: {
      start?: {
        type?: string;
        size?: number;
      };
      end?: {
        type?: string;
        size?: number;
      };
    };
    fill?: {
      color?: string;
    };
  }
  interface NodeProps extends ElementProps {
    highlight?: string[];

    fill?: {
      color?: string;
      type?: 'solid' | 'gradient';
      color2?: string;
    };
  }
}

export type Anchor = {
  point: Point;
  clip?: boolean;
};

export interface DiagramElement {
  id: string;
  type: string;
}

export interface AbstractNode extends DiagramElement {
  type: 'node';
  nodeType: 'group' | string;
  id: string;
  bounds: Box;

  // TODO: Maybe we should make this readonly (deep)?
  props: NodeProps;
  anchors?: Anchor[];
}

export type Waypoint = {
  point: Point;
  controlPoints?: [Point, Point];
};

export interface AbstractEdge extends DiagramElement {
  type: 'edge';
  id: string;
  waypoints?: Waypoint[];
  props: EdgeProps;
}

export type DiagramNodeSnapshot = Pick<AbstractNode, 'id' | 'bounds' | 'props'>;

export class DiagramNode implements AbstractNode {
  id: string;
  bounds: Box;
  type: 'node';
  nodeType: 'group' | string;

  parent?: DiagramNode;
  children: DiagramNode[];

  edges: Record<number, DiagramEdge[]>;

  props: NodeProps = {};

  _anchors?: Anchor[];

  diagram?: Diagram;

  constructor(id: string, nodeType: 'group' | string, bounds: Box, anchors: Anchor[] | undefined) {
    this.id = id;
    this.bounds = bounds;
    this.type = 'node';
    this.nodeType = nodeType;
    this.children = [];
    this.edges = {};
    this._anchors = anchors;
  }

  // TODO: Need to make sure this is called when e.g. props are changed
  private invalidateAnchors() {
    if (!this.diagram) {
      console.log(this);
    }
    assert.present(this.diagram);

    this._anchors = [];
    this._anchors.push({ point: { x: 0.5, y: 0.5 }, clip: true });

    const def = this.diagram!.nodeDefinitions.get(this.nodeType);

    const path = def.getBoundingPath(this);

    for (const p of path.segments) {
      const { x, y } = p.point(0.5);
      const lx = round((x - this.bounds.pos.x) / this.bounds.size.w);
      const ly = round((y - this.bounds.pos.y) / this.bounds.size.h);

      this._anchors.push({ point: { x: lx, y: ly }, clip: false });
    }

    this.diagram.updateElement(this);
  }

  get anchors(): Anchor[] {
    if (this._anchors === undefined) this.invalidateAnchors();

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
    return Point.rotateAround(
      {
        x: this.bounds.pos.x + this.bounds.size.w * this.anchors[anchor].point.x,
        y: this.bounds.pos.y + this.bounds.size.h * this.anchors[anchor].point.y
      },
      this.bounds.rotation,
      Box.center(this.bounds)
    );
  }

  // TODO: This is a bit problematic since it has a relation to edge
  //       should probably rename this to something else - e.g. copyNode
  clone() {
    const node = new DiagramNode(
      this.id,
      this.nodeType,
      deepClone(this.bounds),
      this._anchors ? [...this._anchors] : undefined
    );
    node.props = deepClone(this.props);
    node.children = this.children.map(c => c.clone());
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

  listEdges(includeChildren = true): DiagramEdge[] {
    return [
      ...Object.values(this.edges ?? {}).flatMap(e => e),
      ...(includeChildren ? this.children.flatMap(c => c.listEdges(includeChildren)) : [])
    ];
  }
}

export type ConnectedEndpoint = { anchor: number; node: DiagramNode };
export type Endpoint = ConnectedEndpoint | { position: Point };

// TODO: Maybe make endpoint a class with this as a method?
//       ...or perhaps a property as discriminator
export const isConnected = (endpoint: Endpoint): endpoint is ConnectedEndpoint =>
  'node' in endpoint;

export class DiagramEdge implements AbstractEdge {
  id: string;
  type: 'edge';

  #start: Endpoint;
  #end: Endpoint;

  props: EdgeProps = {};
  waypoints: Waypoint[] | undefined;

  constructor(
    id: string,
    start: Endpoint,
    end: Endpoint,
    props: EdgeProps,
    midpoints?: Waypoint[]
  ) {
    this.id = id;
    this.type = 'edge';
    this.#start = start;
    this.#end = end;
    this.props = props;
    this.waypoints = midpoints;
  }

  // TODO: This is probably not a sufficient way to calculate the bounding box
  get bounds() {
    return Box.fromCorners(this.startPosition, this.endPosition);
  }

  set bounds(b: Box) {
    if (!isConnected(this.start)) this.start = { position: { x: b.pos.x, y: b.pos.y } };
    if (!isConnected(this.end))
      this.end = { position: { x: b.pos.x + b.size.w, y: b.pos.y + b.size.h } };
  }

  get startPosition() {
    return isConnected(this.start)
      ? this.start.node.getAnchorPosition(this.start.anchor)
      : this.start.position;
  }

  isStartConnected() {
    return isConnected(this.start);
  }

  get endPosition() {
    return isConnected(this.end)
      ? this.end.node.getAnchorPosition(this.end.anchor)
      : this.end.position;
  }

  isEndConnected() {
    return isConnected(this.end);
  }

  set start(start: Endpoint) {
    if (isConnected(this.#start) && isConnected(start)) {
      // both before and after are connected
      if (this.#start.node === start.node) {
        this.#start.node.updateEdge(start.anchor, this);
      } else {
        this.#start.node.removeEdge(this);
        start.node.addEdge(start.anchor, this);
      }
    } else if (isConnected(this.#start)) {
      // before is connected, after is not
      this.#start.node.removeEdge(this);
    } else if (isConnected(start)) {
      // before is not connected, after is connected
      start.node.addEdge(start.anchor, this);
    }

    this.#start = start;
  }

  get start() {
    return this.#start;
  }

  set end(end: Endpoint) {
    if (isConnected(this.#end) && isConnected(end)) {
      // both before and after are connected
      if (this.#end.node === end.node) {
        this.#end.node.updateEdge(end.anchor, this);
      } else {
        this.#end.node.removeEdge(this);
        end.node.addEdge(end.anchor, this);
      }
    } else if (isConnected(this.#end)) {
      // before is connected, after is not
      this.#end.node.removeEdge(this);
    } else if (isConnected(end)) {
      // before is not connected, after is connected
      end.node.addEdge(end.anchor, this);
    }

    this.#end = end;
  }

  get end() {
    return this.#end;
  }
}

export type Canvas = Omit<Box, 'rotation'>;

export type DiagramEvents = {
  nodechanged: { after: DiagramNode };
  nodeadded: { node: DiagramNode };
  noderemoved: { node: DiagramNode };
  edgechanged: { after: DiagramEdge };
  edgeadded: { edge: DiagramEdge };
  edgeremoved: { edge: DiagramEdge };
  canvaschanged: { after: Canvas };
};

export class Diagram<T extends DiagramEvents = DiagramEvents> extends EventEmitter<T> {
  elements: (DiagramEdge | DiagramNode)[];
  readonly nodeLookup: Record<string, DiagramNode> = {};
  readonly edgeLookup: Record<string, DiagramEdge> = {};
  readonly undoManager = new UndoManager();

  #canvas: Canvas = {
    pos: { x: 0, y: 0 },
    size: {
      w: 640,
      h: 640
    }
  };

  viewBox = new Viewbox(this.#canvas.size);

  // TODO: Add listener/event on grid change
  readonly grid = {
    x: 20,
    y: 20
  };

  constructor(
    readonly id: string,
    elements: (DiagramEdge | DiagramNode)[],
    readonly nodeDefinitions: NodeDefinitionRegistry,
    readonly edgeDefinitions: EdgeDefinitionRegistry
  ) {
    super();
    this.elements = elements;

    this.elements.forEach(e => {
      if (e.type === 'node') {
        this.linkNode(e);
      }
    });

    for (const e of this.elements) {
      if (e.type === 'edge') {
        this.edgeLookup[e.id] = e;
      } else if (e.type === 'node') {
        this.nodeLookup[e.id] = e;
      } else {
        VERIFY_NOT_REACHED();
      }
    }
  }

  private linkNode(node: DiagramNode) {
    node.diagram = this;
    if (node.nodeType === 'group') {
      for (const child of node.children) {
        child.parent = node;
        this.linkNode(child);
      }
    }
  }

  get canvas() {
    return this.#canvas;
  }

  set canvas(b: Canvas) {
    this.#canvas = b;
    this.emit('canvaschanged', { after: b });

    console.log('CANVAS CHANGED');
  }

  newid() {
    return Math.random().toString(36).substring(2, 9);
  }

  addNode(node: DiagramNode) {
    this.linkNode(node);
    this.nodeLookup[node.id] = node;
    this.elements.push(node);
    this.emit('nodeadded', { node });
  }

  removeNode(node: DiagramNode) {
    delete this.nodeLookup[node.id];
    this.elements = this.elements.filter(e => e !== node);
    this.emit('noderemoved', { node });
  }

  // TODO: Implement this part
  queryNodes() {
    return Object.values(this.nodeLookup);
  }

  transformElements(elements: (DiagramNode | DiagramEdge)[], transforms: Transform[]) {
    for (const el of elements) {
      el.bounds = Transform.box(el.bounds, ...transforms);
    }

    // TODO: Maybe we should call a method on the element for things beyond the bounds

    for (const el of elements) {
      if (el.type === 'edge') {
        const edge = el as DiagramEdge;
        edge.waypoints = edge.waypoints?.map(w => ({
          point: Transform.point(w.point, ...transforms),
          controlPoints: w.controlPoints
            ? [
                Transform.point(w.controlPoints[0], ...transforms),
                Transform.point(w.controlPoints[1], ...transforms)
              ]
            : undefined
        }));
      }
    }

    for (const el of elements) {
      if (el.type === 'node' && el.nodeType === 'group') {
        this.transformElements(el.children, transforms);
      }
    }

    for (let i = 0; i < elements.length; i++) {
      this.updateElement(elements[i]);
    }

    // TODO: Automatically create undoable action?
  }

  addEdge(edge: DiagramEdge) {
    this.edgeLookup[edge.id] = edge;
    this.elements.push(edge);
    this.emit('edgeadded', { edge });
  }

  removeEdge(edge: DiagramEdge) {
    delete this.edgeLookup[edge.id];
    this.elements = this.elements.filter(e => e !== edge);
    this.emit('edgeremoved', { edge });
  }

  updateElement(element: DiagramEdge | DiagramNode) {
    // TODO: We don't have before here
    //       ... should we perhaps remove the before thing
    if (element.type === 'node') {
      this.emit('nodechanged', { after: element });
    } else {
      this.emit('edgechanged', { after: element });
    }
  }

  addHighlight(element: DiagramNode | DiagramEdge, highlight: string) {
    element.props ??= {};
    element.props.highlight ??= [];
    element.props.highlight.push(highlight);
    this.updateElement(element);
  }

  removeHighlight(element: DiagramNode | DiagramEdge, highlight: string) {
    if (!element.props?.highlight) return;
    element.props.highlight = element.props.highlight.filter(h => h !== highlight);
    this.updateElement(element);
  }
}

export type NodeCapability = string;

// TODO: Make make this into an interface in the global namespace we can extend
export type CustomPropertyDefinition = {
  type: 'number';
  label: string;
  value: number;
  minValue?: number;
  maxValue?: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
};

export interface NodeDefinition {
  type: string;
  name: string;

  supports(capability: NodeCapability): boolean;

  getBoundingPath(node: DiagramNode): Path;
  getCustomProperties(node: DiagramNode): Record<string, CustomPropertyDefinition>;
}

export class NodeDefinitionRegistry {
  private nodes: Record<string, NodeDefinition> = {};

  register(node: NodeDefinition) {
    this.nodes[node.type] = node;
  }

  get(type: string): NodeDefinition {
    return this.nodes[type];
  }

  getAll() {
    return Object.values(this.nodes);
  }
}

export type EdgeCapability = string;

export interface EdgeDefinition {
  type: string;

  supports(capability: EdgeCapability): boolean;
}

export class EdgeDefinitionRegistry {
  private edges: Record<string, EdgeDefinition> = {};

  register(edge: EdgeDefinition) {
    this.edges[edge.type] = edge;
  }

  get(type: string): EdgeDefinition {
    return this.edges[type];
  }
}
