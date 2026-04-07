import { Point } from '@diagram-craft/geometry/point';
import { EventEmitter } from '@diagram-craft/utils/event';
import { resolveTargetElement } from '@diagram-craft/utils/dom';
import { CanvasDomHelper } from './utils/canvasDomHelper';

const removeSuffix = (s: string) => {
  return s.replace(/---.+$/, '');
};

// Resolve a canvas DOM hit back to a diagram element id, while ignoring non-canvas
// hits and stripping redraw suffixes added to DOM ids.
export const resolveCanvasDragElementId = (target: EventTarget | null) => {
  const targetElement = resolveTargetElement(target);
  const canvasElement = CanvasDomHelper.canvasElement(target);
  if (!canvasElement) return undefined;

  let element =
    targetElement?.closest('.svg-hover-overlay')?.parentElement ?? targetElement;
  while (element) {
    if (element.id.startsWith('node-')) {
      return removeSuffix(element.id.slice('node-'.length));
    }
    if (element.id.startsWith('edge-')) {
      return removeSuffix(element.id.slice('edge-'.length));
    }
    element = element.parentElement;
  }
  return undefined;
};

const resolveTargetAtPoint = (point: Point) => {
  return document.elementFromPoint(point.x, point.y);
};

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

    const point = { x: event.clientX, y: event.clientY };
    const initialTarget = resolveTargetAtPoint(point) ?? event.target!;

    drag.onDrag(
      new DragEvents.DragStart(point, event, initialTarget)
    );

    const { target: hoverTarget, id: resolvedHoverId } = drag.resolveDragTarget(
      point,
      initialTarget
    );
    drag.onDragEnter(
      new DragEvents.DragEnter(point, hoverTarget, resolvedHoverId)
    );
  });
  document.addEventListener('mouseup', event => {
    const drag = DRAG_DROP_MANAGER.current();
    if (!drag) return;
    if (!drag.isGlobal) {
      // In case we drop outside of the canvas, we need to cancel the drag
      drag.cancel();
      DRAG_DROP_MANAGER.clear();
      return;
    }

    drag.onDragEnd(new DragEvents.DragEnd(event.target!));
    DRAG_DROP_MANAGER.clear();
  });
  document.addEventListener('keydown', event => {
    const drag = DRAG_DROP_MANAGER.current();
    if (!drag) return;

    // Cancel any drag on hitting Escape
    if (event.key === 'Escape') {
      drag.cancel();
      DRAG_DROP_MANAGER.clear();
      return;
    }

    if (!drag.isGlobal) return;

    drag.onKeyDown(event);
  });
  document.addEventListener('keyup', event => {
    const drag = DRAG_DROP_MANAGER.current();
    if (!drag || !drag.isGlobal) return;

    drag.onKeyUp(event);
  });
};

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
      public offset: Point,
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

  abstract cancel(): void;

  onKeyDown(_event: DragEvents.DragKeyDown): void {}

  onKeyUp(_event: DragEvents.DragKeyUp): void {}

  onDragEnter(_event: DragEvents.DragEnter): void {}

  onDragLeave(_event: DragEvents.DragLeave): void {}

  resolveDragTarget(point: Point, fallbackTarget: EventTarget): { target: EventTarget; id?: string } {
    const target = resolveTargetAtPoint(point) ?? fallbackTarget;
    return { target, id: resolveCanvasDragElementId(target) };
  }

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
  private dragStarted = false;
  private onEndCallback?: () => void;
  private didRunOnEndCallback = false;

  initiate(drag: Drag, onEndCallback = () => {}, startImmediately = false) {
    this.drag = drag;
    this.onEndCallback = onEndCallback;
    this.didRunOnEndCallback = false;

    this.dragStarted = startImmediately;
    this.emit('dragStart', { drag });
    this.drag.on('drag', () => {
      this.dragStarted = true;
    });
    this.drag.on('stateChange', ({ state }) => {
      this.emit('dragStateChange', { drag: this.drag!, state });
    });
    this.drag.on('dragEnd', () => {
      if (this.drag !== drag || this.didRunOnEndCallback) return;
      this.didRunOnEndCallback = true;
      this.dragStarted = false;
      this.onEndCallback?.();
      this.onEndCallback = undefined;
    });
  }

  private reset() {
    this.drag = undefined;
    this.dragStarted = false;
    this.onEndCallback = undefined;
    this.didRunOnEndCallback = false;
  }

  private runOnEndCallback() {
    if (this.didRunOnEndCallback) return;
    this.didRunOnEndCallback = true;
    this.onEndCallback?.();
    this.onEndCallback = undefined;
  }

  isDragging() {
    return !!this.drag && this.dragStarted;
  }

  current() {
    return this.drag;
  }

  clear() {
    const drag = this.drag;
    if (!drag) return;

    this.emit('dragEnd', { drag });
    this.runOnEndCallback();
    this.reset();
  }
}

export const DRAG_DROP_MANAGER = new DragDopManager();
