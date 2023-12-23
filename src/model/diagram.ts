import { EventEmitter } from '../utils/event.ts';
import { Transform } from '../geometry/transform.ts';
import { Box } from '../geometry/box.ts';
import { Viewbox } from './viewBox.ts';
import { DiagramElement, DiagramNode } from './diagramNode.ts';
import { DiagramEdge } from './diagramEdge.ts';
import { EdgeDefinitionRegistry, NodeDefinitionRegistry } from './elementDefinitionRegistry.ts';
import { Layer, LayerManager } from './diagramLayer.ts';
import { SelectionState } from './selectionState.ts';
import { UndoManager } from './undoManager.ts';
import { SnapManager } from './snap/snapManager.ts';
import { SnapManagerConfig } from './snap/snapManagerConfig.ts';
import { unique } from '../utils/array.ts';
import { assert } from '../utils/assert.ts';

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

export const excludeLabelNodes = (n: DiagramElement) => {
  if (n.type === 'node' && n.props.labelForEgdeId) return false;
  return true;
};

export const includeAll = () => true;

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
  readonly selectionState: SelectionState = new SelectionState(this);
  readonly layers = new LayerManager(this, []);
  readonly snapManagerConfig = new SnapManagerConfig([
    'grid',
    'node',
    'canvas',
    'distance',
    'size'
  ]);
  readonly undoManager = new UndoManager();

  constructor(
    readonly id: string,
    readonly name: string,
    readonly nodeDefinitions: NodeDefinitionRegistry,
    readonly edgeDefinitions: EdgeDefinitionRegistry,

    // TODO: Remove elements from here
    //       ... but then the logic to create the default layer needs to be moved
    elements?: DiagramElement[]
  ) {
    super();

    if (elements) {
      this.layers.add(new Layer('default', 'Default', [], this));
      elements.forEach(e => this.layers.active.addElement(e, true));
    }
  }

  createSnapManager() {
    return new SnapManager(
      this,
      this.selectionState.elements.map(e => e.id),
      this.snapManagerConfig.magnetTypes,
      this.snapManagerConfig.threshold,
      this.snapManagerConfig.enabled
    );
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

  // TODO: Change this to an undoable action?
  // TODO: Check layer level events are emitted
  moveElement(
    elements: DiagramElement[],
    layer: Layer,
    ref?: { relation: 'above' | 'below'; element: DiagramElement }
  ) {
    const layers = elements.map(e => e.layer);
    const topMostLayer = this.layers.all.findLast(l => layers.includes(l));
    assert.present(topMostLayer);

    if (elements.some(e => e === ref?.element)) return;

    // Remove from existing layers
    const sourceLayers = unique(elements.map(e => e.layer!));
    for (const l of sourceLayers) {
      l.elements = l.elements.filter(e => !elements.includes(e));
    }

    // Move into the new layer
    if (ref === undefined) {
      if (layer.isAbove(topMostLayer)) {
        layer.elements.push(...elements);
      } else {
        layer.elements.unshift(...elements);
      }
    } else {
      assert.true(ref.element.layer === layer);

      for (const e of layer.elements) {
        if (e === ref.element) {
          if (ref.relation === 'above') {
            layer.elements.splice(layer.elements.indexOf(e) + 1, 0, ...elements);
          } else {
            layer.elements.splice(layer.elements.indexOf(e), 0, ...elements);
          }
          break;
        }
      }
    }

    // Assign new layer
    elements.forEach(e => {
      e.layer = layer;
    });

    this.update();
  }

  updateElement(element: DiagramElement) {
    this.emit('elementChange', { element });
  }

  transformElements(
    elements: DiagramElement[],
    transforms: Transform[],
    filter: (e: DiagramElement) => boolean = () => true
  ) {
    for (const el of elements) {
      if (filter(el)) el.transform(transforms);
    }

    // We do this in a separate loop to as nodes might move which will
    // affect the start and end location of connected edges
    for (const el of elements) {
      if (filter(el)) this.updateElement(el);
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
