import { EventEmitter } from '@diagram-craft/utils/event';
import { DiagramNode } from './diagramNode';
import { DiagramEdge } from './diagramEdge';
import { DiagramElement, getAncestors, isEdge, isNode } from './diagramElement';
import { Box } from '@diagram-craft/geometry/box';
import type { Diagram } from './diagram';
import { debounceMicrotask } from '@diagram-craft/utils/debounce';
import { type Releasable, Releasables } from '@diagram-craft/utils/releasable';

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

export type SelectionEvents = {
  /* The selection has changed, e.g. recalculating bounding box
   * This is implicitly triggered by adding/removing elements, as the bounding box
   * is changed - but this should not be relied upon
   */
  change: { selection: Selection };

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

export class Selection extends EventEmitter<SelectionEvents> implements Releasable {
  #bounds: Box;
  //#highlights: ReadonlyArray<Highlight> = [];
  #elements: ReadonlyArray<DiagramElement> = [];
  #source: SelectionSource = {
    elementBoxes: [],
    elementIds: [],
    boundingBox: EMPTY_BOX
  };
  #forcedRotation: boolean = false;
  #dragging: boolean = false;
  readonly #releasables = new Releasables();

  constructor(private diagram: Diagram) {
    super();
    this.#bounds = EMPTY_BOX;
    this.#elements = [];

    const recalculateBoundingBox = debounceMicrotask(() => {
      this.recalculateBoundingBox();
    });
    this.#releasables.add(diagram.on('elementChange', recalculateBoundingBox));
    this.#releasables.add(
      diagram.on('elementRemove', ev => {
        if (this.diagram.lookup(ev.element.id) !== undefined) return;
        if (this.#elements.includes(ev.element)) {
          this.setElements(this.#elements.filter(e => e !== ev.element));
        }
      })
    );
  }

  release(): void {
    this.#releasables.release();
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

  get bounds(): Box {
    return this.#bounds;
  }

  get type(): SelectionType {
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
    this.emitAsyncWithDebounce('change', { selection: this });
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

  setElementIds(elements: string[]) {
    this.setElements(elements.map(e => this.diagram.lookup(e)));
  }

  setElements(elements: ReadonlyArray<DiagramElement | undefined>, rebaseline = true) {
    if (elements.some(e => e?.isLocked())) return;
    this.#forcedRotation = false;

    const oldElements = [...this.#elements];
    this.#elements = elements
      .filter(e => e !== undefined)
      // Ensure we cannot select children in case one of their ancestors is selected
      .filter(e => !getAncestors(e).some(p => elements.includes(p)));

    this.#elements.forEach(e => {
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
}
