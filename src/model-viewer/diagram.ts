import { EventEmitter } from '../utils/event.ts';
import { Transform } from '../geometry/transform.ts';
import { Box } from '../geometry/box.ts';
import { Viewbox } from './viewBox.ts';
import { DiagramElement, DiagramNode } from './diagramNode.ts';
import { DiagramEdge } from './diagramEdge.ts';
import { EdgeDefinitionRegistry, NodeDefinitionRegistry } from './nodeDefinition.ts';
import { Layer, LayerManager } from './diagramLayer.ts';

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

  props: DiagramProps = {};
  diagrams: this[] = [];

  readonly viewBox = new Viewbox(this.#canvas.size);
  readonly nodeLookup: Record<string, DiagramNode> = {};
  readonly edgeLookup: Record<string, DiagramEdge> = {};

  readonly layers = new LayerManager(this, []);

  constructor(
    readonly id: string,
    readonly name: string,
    elements: DiagramElement[],
    readonly nodeDefinitions: NodeDefinitionRegistry,
    readonly edgeDefinitions: EdgeDefinitionRegistry
  ) {
    super();

    this.layers.add(new Layer('default', 'Default', [], this));

    elements.forEach(e => this.layers.active.addElement(e, true));
  }

  visibleElements() {
    return this.layers.visible.flatMap(l => l.elements);
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

  moveElement(element: DiagramElement, layer: Layer, idx?: number) {
    const currentLayer = element.layer!;
    if (idx !== undefined) {
      layer.elements.splice(idx, 0, element);
      element.layer = layer;
    } else if (layer.isAbove(currentLayer)) {
      layer.elements.unshift(element);
      element.layer = layer;
    } else {
      layer.elements.push(element);
      element.layer = layer;
    }
    currentLayer.elements = currentLayer.elements.filter(e => e !== element);
    this.update();
  }

  updateElement(element: DiagramElement) {
    this.emit('elementChange', { element });
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
