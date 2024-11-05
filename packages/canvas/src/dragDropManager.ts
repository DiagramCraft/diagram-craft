import { Point } from '@diagram-craft/geometry/point';
import { EventEmitter } from '@diagram-craft/utils/event';

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

export const bindDocumentDragAndDrop = () => {
  document.addEventListener('mousemove', event => {
    const drag = DRAG_DROP_MANAGER.current();
    if (!drag || !drag.isGlobal) return;

    drag.onDrag(
      new DragEvents.DragStart({ x: event.clientX, y: event.clientY }, event, event.currentTarget!)
    );
  });
  document.addEventListener('mouseup', event => {
    const drag = DRAG_DROP_MANAGER.current();
    if (!drag || !drag.isGlobal) return;

    drag.onDragEnd(new DragEvents.DragEnd(event.currentTarget!));
    DRAG_DROP_MANAGER.clear();
  });
  document.addEventListener('mouseout', event => {
    const drag = DRAG_DROP_MANAGER.current();
    if (!drag || !drag.isGlobal) return;

    drag.onDragLeave(new DragEvents.DragLeave(event.currentTarget!));
  });
  document.addEventListener('mouseoover', event => {
    const drag = DRAG_DROP_MANAGER.current();
    if (!drag || !drag.isGlobal) return;

    drag.onDragEnter(new DragEvents.DragEnter(event.currentTarget!));
  });
  document.addEventListener('keydown', event => {
    const drag = DRAG_DROP_MANAGER.current();
    if (!drag || !drag.isGlobal) return;

    drag.onKeyDown(event!);
  });
  document.addEventListener('keyup', event => {
    const drag = DRAG_DROP_MANAGER.current();
    if (!drag || !drag.isGlobal) return;

    drag.onKeyUp(event!);
  });
};

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace DragEvents {
  export class DragStart {
    constructor(
      public offset: Point,
      public modifiers: Modifiers,
      public target: EventTarget
    ) {}
  }

  export class DragEnd {
    constructor(public target: EventTarget) {}
  }

  export class DragEnter {
    constructor(
      public target: EventTarget,
      public id?: string
    ) {}
  }

  export class DragLeave {
    constructor(
      public target: EventTarget,
      public id?: string
    ) {}
  }

  export type DragKeyDown = KeyboardEvent;
  export type DragKeyUp = KeyboardEvent;
}

export abstract class Drag extends EventEmitter<{
  drag: { coord: Point; modifiers: Modifiers };
  dragEnd: void;
  stateChange: { state: State };
}> {
  #state: State;
  isGlobal = false;

  protected constructor() {
    super();
    this.#state = {};
  }

  abstract onDrag(_event: DragEvents.DragStart): void;

  abstract onDragEnd(_event: DragEvents.DragEnd): void;

  onKeyDown(_event: DragEvents.DragKeyDown): void {}

  onKeyUp(_event: DragEvents.DragKeyUp): void {}

  onDragEnter(_event: DragEvents.DragEnter): void {}

  onDragLeave(_event: DragEvents.DragLeave): void {}

  setState(state: State) {
    this.#state = state;
    this.emit('stateChange', { state: this.#state });
  }

  get state() {
    return this.#state;
  }
}

export class DragDopManager extends EventEmitter<{
  dragStart: { drag: Drag };
  dragEnd: { drag: Drag };
  dragStateChange: { drag: Drag; state: State };
}> {
  private drag?: Drag;

  initiate(drag: Drag, onEndCallback = () => {}) {
    this.drag = drag;
    this.emit('dragStart', { drag });
    this.drag.on('stateChange', ({ state }) => {
      this.emit('dragStateChange', { drag: this.drag!, state });
    });
    this.drag.on('dragEnd', onEndCallback);
  }

  isDragging() {
    return !!this.drag;
  }

  current() {
    return this.drag;
  }

  clear() {
    this.emit('dragEnd', { drag: this.drag! });
    this.drag = undefined;
  }
}

export const DRAG_DROP_MANAGER = new DragDopManager();
