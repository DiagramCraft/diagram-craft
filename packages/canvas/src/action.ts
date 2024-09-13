import { UndoableAction } from '@diagram-craft/model/undoManager';
import { Emitter, EventEmitter, EventKey, EventMap } from '@diagram-craft/utils/event';
import { Point } from '@diagram-craft/geometry/point';

export type ActionEvents = {
  actionChanged: Record<string, never>;
  actionTriggered: Record<string, never>;
};

export type KeyboardActionArgs = { point?: Point; source?: 'keyboard' | 'mouse' | 'ui-element' };

export interface Action<T = undefined> extends Emitter<ActionEvents> {
  execute: (arg: Partial<T>) => void;
  isEnabled: (arg: Partial<T> | T) => boolean;
}

export abstract class AbstractAction<T = undefined>
  extends EventEmitter<ActionEvents>
  implements Action<T>
{
  protected criteria: Array<() => boolean> = [];
  protected enabled: boolean = true;

  isEnabled(_arg: Partial<T>): boolean {
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

export abstract class AbstractToggleAction<T = undefined>
  extends AbstractAction<T>
  implements ToggleAction<T>
{
  protected state: boolean = true;

  getState(_arg: Partial<T>): boolean {
    return this.state;
  }

  abstract execute(arg: Partial<T>): void;
}

export interface ToggleAction<T = unknown> extends Action<T> {
  getState: (arg: T) => boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class ToggleActionUndoableAction<T = any> implements UndoableAction {
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
