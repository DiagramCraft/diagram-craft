import { Point } from '../../geometry/point.ts';
import { EventEmitter } from '../../utils/event.ts';

export type Modifiers = {
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
};

export type State = {
  label?: string;
  props?: Record<string, string>;
  modifiers?: {
    key: string;
    label: string;
    isActive: boolean;
  }[];
};

type DragEvents = {
  drag: { coord: Point; modifiers: Modifiers };
  dragEnd: void;
  stateChange: { state: State };
};

export interface Drag extends EventEmitter<DragEvents> {
  onDrag: (coord: Point, modifiers: Modifiers) => void;
  onDragEnd: () => void;

  onKeyDown?: (event: KeyboardEvent) => void;
  onKeyUp?: (event: KeyboardEvent) => void;
  onDragEnter?: (id: string) => void;
  onDragLeave?: () => void;

  state: State;
}

export abstract class AbstractDrag extends EventEmitter<DragEvents> implements Drag {
  #state: State;

  constructor() {
    super();
    this.#state = {};
  }

  abstract onDrag(coord: Point, modifiers: Modifiers): void;
  abstract onDragEnd(): void;

  onKeyDown(_event: KeyboardEvent): void {
    // Do nothing
  }

  onKeyUp(_event: KeyboardEvent): void {
    // Do nothing
  }

  onDragEnter(_id: string): void {
    // Do nothing
  }

  onDragLeave(): void {
    // Do nothing
  }

  setState(state: State) {
    this.#state = state;
    this.emit('stateChange', { state: this.#state });
  }

  get state() {
    return this.#state;
  }
}

type DragDopEvents = {
  dragStart: { drag: Drag };
  dragEnd: { drag: Drag };
  dragStateChange: { drag: Drag; state: State };
};

export class DragDopManager extends EventEmitter<DragDopEvents> {
  private drag?: Drag;

  initiate(drag: Drag) {
    this.drag = drag;
    this.emit('dragStart', { drag });
    this.drag.on('stateChange', ({ state }) => {
      this.emit('dragStateChange', { drag: this.drag!, state });
    });
  }

  current() {
    return this.drag;
  }

  clear() {
    this.emit('dragEnd', { drag: this.drag! });
    this.drag = undefined;
  }
}
