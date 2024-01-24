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

export interface Action extends Emitter<ActionEvents> {
  execute: (context: ActionContext) => void;
  isEnabled: (context: ActionContext) => boolean;
}

export abstract class AbstractAction extends EventEmitter<ActionEvents> implements Action {
  protected enabled: boolean = true;

  isEnabled(_context: ActionContext): boolean {
    return this.enabled;
  }

  abstract execute(context: ActionContext): void;
}

export interface ToggleAction extends Action {
  state: boolean;
}
