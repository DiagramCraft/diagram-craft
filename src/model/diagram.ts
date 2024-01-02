import { EventEmitter } from '../utils/event.ts';
import { Transform } from '../geometry/transform.ts';
import { Box } from '../geometry/box.ts';
import { Viewbox } from './viewBox.ts';
import { DiagramNode } from './diagramNode.ts';
import { DiagramEdge } from './diagramEdge.ts';
import { EdgeDefinitionRegistry, NodeDefinitionRegistry } from './elementDefinitionRegistry.ts';
import { Layer, LayerManager } from './diagramLayer.ts';
import { SelectionState } from './selectionState.ts';
import { UndoManager } from './undoManager.ts';
import { SnapManager } from './snap/snapManager.ts';
import { SnapManagerConfig } from './snap/snapManagerConfig.ts';
import { assert } from '../utils/assert.ts';
import { UnitOfWork } from './unitOfWork.ts';
import { DiagramElement } from './diagramElement.ts';
import { Point } from '../geometry/point.ts';

export type Canvas = Omit<Box, 'rotation'>;

// TODO: Maybe we could move this into the UnitOfWork instead of passing around a parameter
export type ChangeType = 'interactive' | 'non-interactive';

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

export const excludeLabelNodes = (n: DiagramElement) =>
  !(n.type === 'node' && n.props.labelForEdgeId);

export const includeAll = () => true;

export class Diagram extends EventEmitter<DiagramEvents> {
  #canvas: Canvas = {
    pos: { x: 0, y: 0 },
    size: {
      w: 640,
      h: 640
    }
  };

  diagrams: ReadonlyArray<this> = [];

  readonly props: DiagramProps = {};
  readonly viewBox = new Viewbox(this.#canvas.size);
  readonly nodeLookup = new Map<string, DiagramNode>();
  readonly edgeLookup = new Map<string, DiagramEdge>();
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
    readonly edgeDefinitions: EdgeDefinitionRegistry
  ) {
    super();
  }

  lookup(id: string): DiagramElement | undefined {
    return this.nodeLookup.get(id) ?? this.edgeLookup.get(id);
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

  findElementsByPoint(coord: Point) {
    return this.layers.visible.flatMap(l => l.findElementsByPoint(coord));
  }

  // TODO: Change this to an undoable action?
  // TODO: Check layer level events are emitted
  // TODO: Maybe require a UnitOfWork?
  moveElement(
    elements: ReadonlyArray<DiagramElement>,
    layer: Layer,
    ref?: { relation: 'above' | 'below' | 'on'; element: DiagramElement }
  ) {
    const elementLayers = elements.map(e => e.layer);
    const topMostLayer = this.layers.all.findLast(layer => elementLayers.includes(layer));
    assert.present(topMostLayer);

    // Cannot move an element into itself, so abort if this is the case
    if (elements.some(e => e === ref?.element)) return;

    // Remove from existing layers
    const sourceLayers = new Set(elementLayers);
    for (const l of sourceLayers) {
      l.elements = l.elements.filter(e => !elements.includes(e));
    }

    // Remove from groups
    // TODO: Can optimize by grouping by parent - probably not worth it
    for (const el of elements) {
      if (el.parent) {
        el.parent.children = el.parent.children.filter(e => e !== el);
        el.parent = undefined;
      }
    }

    // Move into the new layer
    if (ref === undefined) {
      if (layer.isAbove(topMostLayer)) {
        layer.elements.push(...elements);
      } else {
        layer.elements.unshift(...elements);
      }
    } else if (ref.element.type === 'node' && ref.element.parent) {
      const parent = ref.element.parent;

      const idx = parent.children.indexOf(ref.element);
      if (ref.relation === 'above') {
        parent.children = parent.children.toSpliced(idx + 1, 0, ...elements);
      } else if (ref.relation === 'below') {
        parent.children = parent.children.toSpliced(idx, 0, ...elements);
      } else {
        ref.element.children = [...ref.element.children, ...elements];
      }
    } else {
      assert.true(ref.element.layer === layer);

      const idx = layer.elements.indexOf(ref.element);
      if (ref.relation === 'above') {
        layer.elements.splice(idx + 1, 0, ...elements);
      } else if (ref.relation === 'below') {
        layer.elements.splice(idx, 0, ...elements);
      } else if (ref.element.type === 'node') {
        ref.element.children = [...ref.element.children, ...elements];
      }
    }

    // Assign new layer
    elements.forEach(e => (e.layer = layer));

    this.update();
  }

  transformElements(
    elements: ReadonlyArray<DiagramElement>,
    transforms: ReadonlyArray<Transform>,
    uow: UnitOfWork,
    type: ChangeType = 'non-interactive',
    filter: (e: DiagramElement) => boolean = () => true
  ) {
    for (const el of elements) {
      if (filter(el)) el.transform(transforms, uow, type);
    }

    // We do this in a separate loop to as nodes might move which will
    // affect the start and end location of connected edges
    for (const el of elements) {
      if (filter(el)) uow.updateElement(el);
    }
  }

  // TODO: Maybe we should remove this in favour for UnitOfWork
  /** @deprecated */
  updateElement(element: DiagramElement) {
    this.emit('elementChange', { element });
  }

  // TODO: Remove this
  /** @deprecated */
  update() {
    this.emit('change', { diagram: this });
  }
}
