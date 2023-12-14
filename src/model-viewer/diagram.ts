import { EventEmitter } from '../utils/event.ts';
import { Transform } from '../geometry/transform.ts';
import { Box } from '../geometry/box.ts';
import { Viewbox } from './viewBox.ts';
import { DiagramElement, DiagramNode } from './diagramNode.ts';
import { DiagramEdge } from './diagramEdge.ts';
import { EdgeDefinitionRegistry, NodeDefinitionRegistry } from './nodeDefinition.ts';

export type Canvas = Omit<Box, 'rotation'>;

export type DiagramEvents = {
  /* Diagram props, canvas have changed, or a large restructure of
   * elements have occured (e.g. change of stacking order)
   */
  change: { diagram: Diagram };

  /* A single element has changed (e.g. moved, resized, etc) */
  elementChange: { element: DiagramElement };

  /* A new element has been added to the diagram */
  elementAdd: { element: DiagramElement };

  /* An element has been removed from the diagram */
  elementRemove: { element: DiagramElement };
};

export type StackPosition = { element: DiagramElement; idx: number };

export class Diagram extends EventEmitter<DiagramEvents> {
  #canvas: Canvas = {
    pos: { x: 0, y: 0 },
    size: {
      w: 640,
      h: 640
    }
  };

  elements: DiagramElement[] = [];
  props: DiagramProps = {};
  diagrams: this[] = [];

  readonly viewBox = new Viewbox(this.#canvas.size);
  readonly nodeLookup: Record<string, DiagramNode> = {};
  readonly edgeLookup: Record<string, DiagramEdge> = {};

  constructor(
    readonly id: string,
    readonly name: string,
    elements: DiagramElement[],
    readonly nodeDefinitions: NodeDefinitionRegistry,
    readonly edgeDefinitions: EdgeDefinitionRegistry
  ) {
    super();

    elements.forEach(e => this.addElement(e, true));
  }

  get canvas() {
    return this.#canvas;
  }

  set canvas(b: Canvas) {
    this.#canvas = b;
    this.emit('change', { diagram: this });
  }

  findChildDiagramById(id: string): this | undefined {
    return (
      this.diagrams.find(d => d.id === id) ??
      this.diagrams.map(d => d.findChildDiagramById(id)).find(d => d !== undefined)
    );
  }

  addElement(element: DiagramElement, omitEvents = false) {
    this.elements.push(element);
    this.processElementForAdd(element);

    if (element.type === 'node') {
      this.nodeLookup[element.id] = element;
    } else if (element.type === 'edge') {
      this.edgeLookup[element.id] = element;
    }
    if (!omitEvents) this.emit('elementAdd', { element });
  }

  removeElement(element: DiagramElement) {
    this.elements = this.elements.filter(e => e !== element);

    if (element.type === 'node') {
      delete this.nodeLookup[element.id];
    } else if (element.type === 'edge') {
      delete this.edgeLookup[element.id];
    }

    this.emit('elementRemove', { element });
  }

  updateElement(element: DiagramElement) {
    this.emit('elementChange', { element });
  }

  private processElementForAdd(e: DiagramElement) {
    e.diagram = this;
    if (e.type === 'node' && e.nodeType === 'group') {
      for (const child of e.children) {
        child.parent = e;
        this.processElementForAdd(child);
      }
    }
  }

  stackModify(elements: DiagramElement[], newPosition: number): StackPosition[] {
    const withPositions = this.elements.map((e, i) => ({ element: e, idx: i }));
    const oldPositions = this.elements.map((e, i) => ({ element: e, idx: i }));

    for (const el of elements) {
      const idx = withPositions.findIndex(e => e.element === el);
      withPositions[idx].idx += newPosition;
    }

    withPositions.sort((a, b) => a.idx - b.idx);
    this.elements = withPositions.map(e => e.element);
    this.emit('change', { diagram: this });

    return oldPositions;
  }

  stackSet(positions: StackPosition[]) {
    positions.sort((a, b) => a.idx - b.idx);
    this.elements = positions.map(e => e.element);
    this.emit('change', { diagram: this });
  }

  transformElements(elements: DiagramElement[], transforms: Transform[]) {
    for (const el of elements) {
      el.transform(transforms);
    }

    // We do this in a separate loop to as nodes might move which will
    // affect the start and end location of connected edges
    for (const el of elements) {
      this.updateElement(el);
    }
  }

  update() {
    this.emit('change', { diagram: this });
  }

  addHighlight(element: DiagramElement, highlight: string) {
    element.props ??= {};
    element.props.highlight ??= [];
    element.props.highlight.push(highlight);
    this.updateElement(element);
  }

  removeHighlight(element: DiagramElement, highlight: string) {
    if (!element.props?.highlight) return;
    element.props.highlight = element.props.highlight.filter(h => h !== highlight);
    this.updateElement(element);
  }
}
