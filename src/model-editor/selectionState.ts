import { Line } from '../geometry/line.ts';
import { precondition } from '../utils/assert.ts';
import { EventEmitter } from '../utils/event.ts';
import { Box } from '../geometry/box.ts';
import { Magnet } from './snap/magnet.ts';
import { DiagramElement, DiagramNode } from '../model-viewer/diagramNode.ts';
import { DiagramEdge } from '../model-viewer/diagramEdge.ts';
import { EditableDiagram } from './editable-diagram.ts';
import { debounce } from '../utils/debounce.ts';

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
  /* The selection has changed, this includes adding, removing elements, but also
   * recalculating bounding box */
  change: { selection: SelectionState };

  /* Elements have been added to the selection */
  add: { element: DiagramElement };

  /* Elements have been removed from the selection */
  remove: { element: DiagramElement };
};

type SelectionType = 'empty' | 'single-node' | 'single-edge' | 'edges' | 'nodes' | 'mixed';

// TODO: Maybe create a marquee class
export class SelectionState extends EventEmitter<SelectionStateEvents> {
  #bounds: Box;
  #marquee?: Box;
  #guides: Guide[] = [];
  #elements: DiagramElement[] = [];
  #source: SelectionSource = {
    elementBoxes: [],
    elementIds: [],
    boundingBox: EMPTY_BOX
  };

  // For marquee selection
  pendingElements?: DiagramElement[];

  constructor(diagram: EditableDiagram) {
    super();
    this.#bounds = EMPTY_BOX;
    this.#elements = [];

    const recalculateSourceBoundingBox = debounce(() => {
      this.recalculateBoundingBox();
    });
    diagram.on('nodechanged', recalculateSourceBoundingBox);
    diagram.on('edgechanged', recalculateSourceBoundingBox);
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

  get marquee(): Box | undefined {
    return this.#marquee;
  }

  set marquee(marquee: Box | undefined) {
    this.#marquee = marquee;
    this.emitAsync('change', { selection: this });
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
    element.forEach(e => {
      if (this.#elements.includes(e)) return;
      this.emit('add', { element: e });
    });
    this.#elements.forEach(e => {
      if (element.includes(e)) return;
      this.emit('remove', { element: e });
    });

    this.#elements = element;
    this.recalculateBoundingBox();

    if (rebaseline) this.rebaseline();
  }

  clear() {
    this.#marquee = undefined;
    this.#guides = [];
    this.pendingElements = undefined;

    this.setElements([]);
  }

  convertMarqueeToSelection() {
    precondition.is.present(this.pendingElements);

    this.marquee = undefined;

    this.setElements([
      ...this.pendingElements.filter(e => !this.#elements.includes(e)),
      ...this.#elements
    ]);

    this.pendingElements = undefined;
  }

  rebaseline() {
    this.#source.elementBoxes = this.#elements.map(e => e.bounds);
    this.#source.elementIds = this.#elements.map(e => e.id);
    this.recalculateSourceBoundingBox();
  }

  recalculateBoundingBox() {
    this.#bounds = this.isEmpty() ? EMPTY_BOX : Box.boundingBox(this.#elements.map(e => e.bounds));
    this.emitAsync('change', { selection: this });
  }

  private recalculateSourceBoundingBox() {
    this.#source.boundingBox =
      this.#source.elementBoxes.length === 0
        ? EMPTY_BOX
        : Box.boundingBox(this.#source.elementBoxes.map(e => e));
  }
}
