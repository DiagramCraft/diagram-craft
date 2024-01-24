import { Point } from '../geometry/point.ts';
import { Emitter, EventEmitter } from '../utils/event.ts';

export type ActionEvents = {
  actionchanged: { action: Action };
  actiontriggered: { action: Action };
};

export type ActionContext = {
  point?: Point;
  id?: string;
};

export interface Action<T = never> extends Emitter<ActionEvents> {
  execute: (context: ActionContext, arg?: T) => void;
  isEnabled: (context: ActionContext) => boolean;
}

export abstract class AbstractAction<T = never>
  extends EventEmitter<ActionEvents>
  implements Action<T>
{
  protected enabled: boolean = true;

  isEnabled(_context: ActionContext): boolean {
    return this.enabled;
  }

  abstract execute(context: ActionContext): void;
}

export abstract class AbstractToggleAction<T = never>
  extends AbstractAction<T>
  implements ToggleAction
{
  protected state: boolean = true;

  getState(_context: ActionContext): boolean {
    return this.state;
  }

  abstract execute(context: ActionContext): void;
}

export interface ToggleAction extends Action {
  getState: (context: ActionContext) => boolean;
}
