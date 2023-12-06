import { Line } from '../geometry/line.ts';
import { precondition } from '../utils/assert.ts';
import { EventEmitter } from '../utils/event.ts';
import { Box } from '../geometry/box.ts';
import { DiagramEdge, DiagramNode } from '../model-viewer/diagram.ts';
import { Magnet } from './snap/magnet.ts';

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

// TODO: Should probably include the magnets as well
export type Guide = {
  line: Line;
  label?: string;
  selfMagnet: Magnet;
  matchingMagnet: Magnet;
};

export type SelectionStateEvents = {
  change: { selection: SelectionState };
  add: { element: DiagramNode | DiagramEdge };
  remove: { element: DiagramNode | DiagramEdge };
};

export class SelectionState extends EventEmitter<SelectionStateEvents> {
  private _bounds: Box;
  private _marquee?: Box;
  private _guides: Guide[] = [];

  // TODO: This is mostly here for debugging purposes
  private _magnets: Magnet[] = [];

  elements: (DiagramEdge | DiagramNode)[] = [];

  source: SelectionSource = {
    elementBoxes: [],
    elementIds: [],
    boundingBox: EMPTY_BOX
  };

  // For marquee selection
  pendingElements?: (DiagramNode | DiagramEdge)[];

  state: Record<string, unknown> = {};

  constructor() {
    super();
    this._bounds = EMPTY_BOX;
    this.elements = [];
  }

  get nodes(): DiagramNode[] {
    return this.elements.filter(e => e.type === 'node') as DiagramNode[];
  }

  get edges(): DiagramEdge[] {
    return this.elements.filter(e => e.type === 'edge') as DiagramEdge[];
  }

  get guides(): Guide[] {
    return this._guides;
  }

  set guides(guides: Guide[]) {
    this._guides = guides;
    this.emit('change', { selection: this });
  }

  get magnets(): Magnet[] {
    return this._magnets;
  }

  set magnets(magnets: Magnet[]) {
    this._magnets = magnets;
    this.emit('change', { selection: this });
  }

  get bounds(): Box {
    return this._bounds;
  }

  // TODO: Why do we need set bounds - can't we just recalculate the bounding box?
  set bounds(bounds: Box) {
    this._bounds = bounds;
    this.emit('change', { selection: this });
  }

  get marquee(): Box | undefined {
    return this._marquee;
  }

  set marquee(marquee: Box | undefined) {
    this._marquee = marquee;
    this.emit('change', { selection: this });
  }

  isChanged(): boolean {
    return this.elements.some((node, i) => {
      const original = this.source.elementBoxes[i];
      return !Box.isEqual(node.bounds, original);
    });
  }

  isEmpty() {
    return this.elements.length === 0;
  }

  recalculateBoundingBox() {
    this._bounds = this.isEmpty() ? EMPTY_BOX : Box.boundingBox(this.elements.map(e => e.bounds));
    this.emit('change', { selection: this });
  }

  recalculateSourceBoundingBox() {
    this.source.boundingBox =
      this.source.elementBoxes.length === 0
        ? EMPTY_BOX
        : Box.boundingBox(this.source.elementBoxes.map(e => e));
  }

  toggle(element: DiagramNode | DiagramEdge) {
    const shouldRemove = this.elements.includes(element);
    this.elements = shouldRemove
      ? this.elements.filter(e => e !== element)
      : [...this.elements, element];

    this.source.elementBoxes = this.elements.map(e => e.bounds);
    this.source.elementIds = this.elements.map(e => e.id);

    this.recalculateSourceBoundingBox();
    this.recalculateBoundingBox();

    if (shouldRemove) {
      this.emit('remove', { element });
    } else {
      this.emit('add', { element });
    }
  }

  setElements(element: (DiagramNode | DiagramEdge)[]) {
    this.elements = element;
    this.source.elementBoxes = this.elements.map(e => e.bounds);
    this.source.elementIds = this.elements.map(e => e.id);

    this.recalculateSourceBoundingBox();
    this.recalculateBoundingBox();
  }

  clear() {
    this.elements.forEach(e => {
      this.emit('remove', { element: e });
    });

    this.elements = [];
    this.source.elementBoxes = [];
    this.source.elementIds = [];
    this._marquee = undefined;
    this._guides = [];
    this.pendingElements = undefined;

    this.recalculateSourceBoundingBox();
    this.recalculateBoundingBox();
  }

  setPendingElements(pendingElemenets: (DiagramNode | DiagramEdge)[]) {
    this.pendingElements = pendingElemenets;
  }

  convertMarqueeToSelection() {
    precondition.is.present(this.pendingElements);

    for (const e of this.pendingElements) {
      if (!this.elements.includes(e)) this.toggle(e);
    }

    this.recalculateSourceBoundingBox();
    this.recalculateBoundingBox();

    this.pendingElements = undefined;

    this.marquee = undefined;
  }

  rebaseline() {
    this.source.elementBoxes = this.elements.map(e => e.bounds);
    this.source.elementIds = this.elements.map(e => e.id);
    this.recalculateSourceBoundingBox();

    this.emit('change', { selection: this });
  }
}
