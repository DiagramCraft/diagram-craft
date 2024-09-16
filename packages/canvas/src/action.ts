import { UndoableAction } from '@diagram-craft/model/undoManager';
import { Emitter, EventEmitter, EventKey, EventMap } from '@diagram-craft/utils/event';
import { Point } from '@diagram-craft/geometry/point';
import { EmptyObject } from '@diagram-craft/utils/types';
import { model } from './modelState';

export type ActionEvents = {
  /**
   * This event is emitted when the action is enabled or disabled.
   */
  actionChanged: EmptyObject;

  /**
   * This event is emitted when the action is triggered.
   */
  actionTriggered: EmptyObject;
};

/**
 * This is the base action args that will be provided for actions triggered from keybindings or
 * other non-explicit means
 *
 * It includes the current mouse position and the source of the action (e.g. mouse, keyboard, etc)
 */
export type BaseActionArgs = { point?: Point; source?: 'keyboard' | 'mouse' | 'ui-element' };

export type ActionContext = {
  model: typeof model;
};

export interface Action<T = undefined> extends Emitter<ActionEvents> {
  execute: (arg: Partial<T>) => void;
  isEnabled: (arg: Partial<T> | T) => boolean;
}

export abstract class AbstractAction<T = undefined, C extends ActionContext = ActionContext>
  extends EventEmitter<ActionEvents>
  implements Action<T>
{
  protected criteria: Array<() => boolean> = [];
  protected enabled: boolean = true;
  protected context: C;

  constructor(context: C) {
    super();
    this.context = context;
  }

  isEnabled(_arg: Partial<T> | T): boolean {
    return this.enabled;
  }

  abstract execute(arg: Partial<T>): void;

  addCriterion<T extends EventMap>(
    target: EventEmitter<T>,
    k: EventKey<T>,
    callback: () => boolean
  ) {
    this.criteria.push(callback);

    const listener = () => {
      const result = this.criteria.reduce((acc, criterion) => acc && criterion(), true);
      if (result === this.enabled) return;

      this.enabled = result;
      this.emit('actionChanged');
    };

    target.on(k, listener);
    listener();
  }
}

export abstract class AbstractToggleAction<T = undefined, C extends ActionContext = ActionContext>
  extends AbstractAction<T, C>
  implements ToggleAction<T>
{
  protected state: boolean = true;

  constructor(context: C) {
    super(context);
    this.context = context;
  }

  getState(_arg: Partial<T>): boolean {
    return this.state;
  }

  abstract execute(arg: Partial<T>): void;
}

export interface ToggleAction<T = unknown> extends Action<T> {
  getState: (arg: T) => boolean;
}

export class ToggleActionUndoableAction<T = undefined> implements UndoableAction {
  constructor(
    public description: string,
    private readonly action: ToggleAction<T>,
    private readonly arg: T
  ) {}

  undo() {
    this.action.execute(this.arg);
  }

  redo() {
    this.action.execute(this.arg);
  }
}
