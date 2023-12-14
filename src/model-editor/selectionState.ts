import { Line } from '../geometry/line.ts';
import { EventEmitter } from '../utils/event.ts';
import { Box } from '../geometry/box.ts';
import { Magnet } from './snap/magnet.ts';
import { DiagramElement, DiagramNode } from '../model-viewer/diagramNode.ts';
import { DiagramEdge } from '../model-viewer/diagramEdge.ts';
import { EditableDiagram } from './editable-diagram.ts';
import { debounce } from '../utils/debounce.ts';
import { Marquee } from './marquee.ts';

const EMPTY_BOX = {
  pos: { x: Number.MIN_SAFE_INTEGER, y: Number.MIN_SAFE_INTEGER },
  size: { w: 0, h: 0 },
  rotation: 0
};

type SelectionSource = {
  elementBoxes: Box[];
  elementIds: string[];
  boundingBox: Box;
};

export type Guide = {
  line: Line;
  label?: string;
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

export type SelectionType = 'empty' | 'single-node' | 'single-edge' | 'edges' | 'nodes' | 'mixed';

export class SelectionState extends EventEmitter<SelectionStateEvents> {
  readonly #marquee: Marquee;

  #bounds: Box;
  #guides: Guide[] = [];
  #elements: DiagramElement[] = [];
  #source: SelectionSource = {
    elementBoxes: [],
    elementIds: [],
    boundingBox: EMPTY_BOX
  };

  constructor(diagram: EditableDiagram) {
    super();
    this.#bounds = EMPTY_BOX;
    this.#elements = [];
    this.#marquee = new Marquee(this);

    const recalculateSourceBoundingBox = debounce(() => {
      this.recalculateBoundingBox();
    });
    diagram.on('elementChange', recalculateSourceBoundingBox);
  }

  get source() {
    return this.#source;
  }

  get elements(): DiagramElement[] {
    return this.#elements;
  }

  get nodes(): DiagramNode[] {
    return this.#elements.filter(e => e.type === 'node') as DiagramNode[];
  }

  get edges(): DiagramEdge[] {
    return this.#elements.filter(e => e.type === 'edge') as DiagramEdge[];
  }

  get guides(): Guide[] {
    return this.#guides;
  }

  set guides(guides: Guide[]) {
    this.#guides = guides;
    this.emitAsync('change', { selection: this });
  }

  get bounds(): Box {
    return this.#bounds;
  }

  get marquee() {
    return this.#marquee;
  }

  getSelectionType(): SelectionType {
    if (this.#elements.length === 0) {
      return 'empty';
    }

    if (this.#elements.length === 1) {
      return this.#elements[0].type === 'node' ? 'single-node' : 'single-edge';
    }

    if (this.#elements.every(e => e.type === 'node')) {
      return 'nodes';
    }

    if (this.#elements.every(e => e.type === 'edge')) {
      return 'edges';
    }

    return 'mixed';
  }

  isNodesOnly(): boolean {
    return ['nodes', 'single-node'].includes(this.getSelectionType());
  }

  isEdgesOnly(): boolean {
    return ['edges', 'single-edge'].includes(this.getSelectionType());
  }

  isChanged(): boolean {
    return this.#elements.some((node, i) => {
      const original = this.#source.elementBoxes[i];
      return !Box.isEqual(node.bounds, original);
    });
  }

  isEmpty() {
    return this.#elements.length === 0;
  }

  toggle(element: DiagramElement) {
    const shouldRemove = this.#elements.includes(element);

    this.setElements(
      shouldRemove ? this.#elements.filter(e => e !== element) : [...this.#elements, element]
    );
  }

  setElements(element: DiagramElement[], rebaseline = true) {
    const oldElements = [...this.#elements];
    this.#elements = element;

    element.forEach(e => {
      if (oldElements.includes(e)) return;
      this.emit('add', { element: e });
    });
    oldElements.forEach(e => {
      if (element.includes(e)) return;
      this.emit('remove', { element: e });
    });

    this.recalculateBoundingBox();

    if (rebaseline) this.rebaseline();
  }

  clear() {
    this.#marquee.clear();
    this.#guides = [];

    this.setElements([]);
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
    this.#bounds = this.isEmpty() ? EMPTY_BOX : Box.boundingBox(this.#elements.map(e => e.bounds));
    this.emitAsync('change', { selection: this });
  }
}
