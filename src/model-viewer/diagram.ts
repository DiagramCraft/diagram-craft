import { EventEmitter } from '../utils/event.ts';
import { VERIFY_NOT_REACHED } from '../utils/assert.ts';
import { Transform } from '../geometry/transform.ts';
import { Box } from '../geometry/box.ts';
import { UndoManager } from '../model-editor/undoManager.ts';
import { Viewbox } from './viewBox.ts';
import { DiagramNode } from './diagramNode.ts';
import { DiagramEdge } from './diagramEdge.ts';
import { EdgeDefinitionRegistry, NodeDefinitionRegistry } from './nodeDefinition.ts';

export interface AbstractElement {
  id: string;
  type: string;
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

  props: DiagramProps = {};

  #canvas: Canvas = {
    pos: { x: 0, y: 0 },
    size: {
      w: 640,
      h: 640
    }
  };

  viewBox = new Viewbox(this.#canvas.size);

  diagrams: Diagram[] = [];

  constructor(
    readonly id: string,
    readonly name: string,
    elements: (DiagramEdge | DiagramNode)[],
    readonly nodeDefinitions: NodeDefinitionRegistry,
    readonly edgeDefinitions: EdgeDefinitionRegistry
  ) {
    super();
    this.elements = elements;

    this.elements.forEach(e => {
      if (e.type === 'node') {
        this.linkNode(e);
      } else if (e.type === 'edge') {
        this.linkEdge(e);
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

  private linkEdge(edge: DiagramEdge) {
    edge.diagram = this;
  }

  get canvas() {
    return this.#canvas;
  }

  set canvas(b: Canvas) {
    this.#canvas = b;
    this.emit('canvaschanged', { after: b });

    console.log('CANVAS CHANGED');
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
      el.transform(transforms);
    }

    // We do this in a separate loop to as nodes might move which will
    // affect the start and end location of connected edges
    for (const el of elements) {
      this.updateElement(el);
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

  update() {
    this.emit('canvaschanged', { after: this.canvas });
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
