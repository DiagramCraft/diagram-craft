import { Point } from '@diagram-craft/geometry/point';
import { UndoableAction } from '@diagram-craft/model/undoManager';
import { Emitter, EventEmitter, EventKey, EventMap } from '@diagram-craft/utils/event';
import { ApplicationTriggers } from './ApplicationTriggers';

export type ActionEvents = {
  actionchanged: { action: Action };
  actiontriggered: { action: Action };
};

export type ActionContext = {
  point?: Point;
  id?: string;
  source?: 'keyboard' | 'mouse' | 'ui-element';
  applicationTriggers?: ApplicationTriggers;
};

export interface Action<T = unknown> extends Emitter<ActionEvents> {
  execute: (context: ActionContext, arg?: T) => void;
  isEnabled: (context: ActionContext) => boolean;
}

export abstract class AbstractAction<T = unknown>
  extends EventEmitter<ActionEvents>
  implements Action<T>
{
  protected criteria: Array<() => boolean> = [];
  protected enabled: boolean = true;

  isEnabled(_context: ActionContext): boolean {
    return this.enabled;
  }

  abstract execute(context: ActionContext, arg?: T): void;

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
      // @ts-ignore
      this.emit('actionchanged', { action: this });
    };

    target.on(k, listener);
    listener();
  }
}

export abstract class AbstractToggleAction<T = unknown>
  extends AbstractAction<T>
  implements ToggleAction<T>
{
  protected state: boolean = true;

  getState(_context: ActionContext): boolean {
    return this.state;
  }

  abstract execute(context: ActionContext, arg?: T): void;
}

export interface ToggleAction<T = unknown> extends Action<T> {
  getState: (context: ActionContext) => boolean;
}

export class ToggleActionUndoableAction implements UndoableAction {
  constructor(
    public description: string,
    private readonly action: ToggleAction,
    private readonly context: ActionContext
  ) {}

  undo() {
    this.action.execute(this.context);
  }

  redo() {
    this.action.execute(this.context);
  }
}
