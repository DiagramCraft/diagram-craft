import { EventEmitter } from '@diagram-craft/utils/event';
import { Magnet } from './snap/magnet';
import { DiagramNode } from './diagramNode';
import { DiagramEdge } from './diagramEdge';
import { DiagramElement, isEdge, isNode } from './diagramElement';
import { Box } from '@diagram-craft/geometry/box';
import { Line } from '@diagram-craft/geometry/line';
import { Marquee } from './marquee';
import type { Diagram } from './diagram';
import { debounceMicrotask } from '@diagram-craft/utils/debounce';

const EMPTY_BOX: Box = {
  x: Number.MIN_SAFE_INTEGER,
  y: Number.MIN_SAFE_INTEGER,
  w: 0,
  h: 0,
  r: 0
};

type SelectionSource = {
  elementBoxes: ReadonlyArray<Box>;
  elementIds: ReadonlyArray<string>;
  boundingBox: Box;
};

export type Highlight = {
  line: Line;
  //label?: string;
  selfMagnet: Magnet;
  matchingMagnet: Magnet;
};

export type SelectionStateEvents = {
  /* The selection has changed, e.g. recalculating bounding box
   * This is implicitly triggered by adding/removing elements, as the bounding box
   * is changed - but this should not be relied upon
   */
  change: { selection: SelectionState };

  /* Elements have been added to the selection */
  add: { element: DiagramElement };

  /* Elements have been removed from the selection */
  remove: { element: DiagramElement };
};

export type SelectionType =
  | 'empty'
  | 'single-node'
  | 'single-edge'
  | 'edges'
  | 'nodes'
  | 'mixed'
  | 'single-label-node';

type ElementPredicate = (e: DiagramElement) => boolean;

export const excludeLabelNodes: ElementPredicate = (n: DiagramElement) =>
  !isNode(n) || !n.isLabelNode();

export const includeAll: ElementPredicate = () => true;

export class SelectionState extends EventEmitter<SelectionStateEvents> {
  readonly #marquee: Marquee;

  #bounds: Box;
  #highlights: ReadonlyArray<Highlight> = [];
  #elements: ReadonlyArray<DiagramElement> = [];
  #source: SelectionSource = {
    elementBoxes: [],
    elementIds: [],
    boundingBox: EMPTY_BOX
  };
  #forcedRotation: boolean = false;
  #dragging: boolean = false;

  constructor(private diagram: Diagram) {
    super();
    this.#bounds = EMPTY_BOX;
    this.#elements = [];
    this.#marquee = new Marquee(this);

    const recalculateBoundingBox = debounceMicrotask(() => {
      this.recalculateBoundingBox();
    });
    diagram.on('elementChange', recalculateBoundingBox);
  }

  filterSelectionToVisibleElements() {
    this.#elements = this.#elements.filter(e => {
      return this.diagram.layers.visible.includes(e.layer);
    });
    this.recalculateBoundingBox();
    this.emit('change', { selection: this });
  }

  setDragging(dragging: boolean) {
    if (this.#dragging === dragging) return;
    this.#dragging = dragging;
    this.emit('change', { selection: this });
  }

  isDragging() {
    return this.#dragging;
  }

  get source() {
    return this.#source;
  }

  get elements() {
    return this.#elements;
  }

  get nodes(): Array<DiagramNode> {
    return this.#elements.filter(isNode);
  }

  get edges(): Array<DiagramEdge> {
    return this.#elements.filter(isEdge);
  }

  filter(
    type: 'all' | 'edges' | 'nodes',
    predicate: ElementPredicate = includeAll
  ): readonly DiagramElement[] {
    if (type === 'all') {
      return this.#elements.filter(predicate);
    } else if (type === 'edges') {
      return this.edges.filter(predicate);
    } else {
      return this.nodes.filter(predicate);
    }
  }

  get highlights() {
    return this.#highlights;
  }

  set highlights(guides: ReadonlyArray<Highlight>) {
    this.#highlights = guides;
    this.emitAsyncWithDebounce('change', { selection: this });
  }

  get bounds(): Box {
    return this.#bounds;
  }

  get marquee() {
    return this.#marquee;
  }

  forceRotation(r: number | undefined) {
    if (r === undefined) {
      this.#forcedRotation = false;
      return;
    }
    this.#bounds = {
      ...this.#bounds,
      r: r
    };
    this.#forcedRotation = true;
  }

  getSelectionType(): SelectionType {
    if (this.isEmpty()) {
      return 'empty';
    } else if (this.#elements.length === 1) {
      const [element] = this.#elements;
      if (isNode(element) && element.isLabelNode()) {
        return 'single-label-node';
      }
      return isNode(element) ? 'single-node' : 'single-edge';
    } else if (this.isNodesOnly()) {
      return 'nodes';
    } else if (this.isEdgesOnly()) {
      return 'edges';
    } else {
      return 'mixed';
    }
  }

  isNodesOnly(): boolean {
    return this.#elements.length > 0 && this.#elements.every(isNode);
  }

  isEdgesOnly(): boolean {
    return this.#elements.length > 0 && this.#elements.every(isEdge);
  }

  isChanged(): boolean {
    return this.#elements.some((node, i) => {
      return !Box.isEqual(node.bounds, this.#source.elementBoxes[i]!);
    });
  }

  isEmpty() {
    return this.#elements.length === 0;
  }

  toggle(element: DiagramElement) {
    if (element.isLocked()) return;

    this.#forcedRotation = false;
    const shouldRemove = this.#elements.includes(element);

    this.setElements(
      shouldRemove ? this.#elements.filter(e => e !== element) : [...this.#elements, element]
    );
  }

  setElements(elements: ReadonlyArray<DiagramElement>, rebaseline = true) {
    if (elements.some(e => e.isLocked())) return;
    this.#forcedRotation = false;

    const oldElements = [...this.#elements];
    this.#elements = elements;

    elements.forEach(e => {
      if (oldElements.includes(e)) return;
      this.emit('add', { element: e });
    });
    oldElements.forEach(e => {
      if (elements.includes(e)) return;
      this.emitAsyncWithDebounce('remove', { element: e });
    });

    this.recalculateBoundingBox();

    if (rebaseline) this.rebaseline();
  }

  clear() {
    this.#marquee.clear();
    this.#highlights = [];

    this.setElements([]);
  }

  getParents() {
    const parents = new Set<DiagramElement>();
    for (const el of this.elements) {
      let parent = el.parent;
      while (parent) {
        parents.add(parent);
        parent = parent.parent;
      }
    }
    return parents;
  }

  /* To be used once a transform operation on the selection has been completed.
   * It resets the source elements that are used for tracking changes.
   */
  rebaseline() {
    this.#source.elementBoxes = this.#elements.map(e => e.bounds);
    this.#source.elementIds = this.#elements.map(e => e.id);
    this.#source.boundingBox =
      this.#source.elementBoxes.length === 0
        ? EMPTY_BOX
        : Box.boundingBox(this.#source.elementBoxes.map(e => e));
  }

  /* Note, calling this externally should not be needed from a functional point of view,
   * as the selection state will automatically recalculate the bounding box when needed.
   * However, it can be useful from a performance point of view - hence it's used when
   * moving and resizing elements
   */
  recalculateBoundingBox() {
    if (this.#forcedRotation) return;
    this.#bounds = this.isEmpty() ? EMPTY_BOX : Box.boundingBox(this.#elements.map(e => e.bounds));
    this.emitAsyncWithDebounce('change', { selection: this });
  }

  toJSON() {
    return {
      bounds: this.bounds,
      elements: this.elements,
      type: this.getSelectionType()
    };
  }
}
