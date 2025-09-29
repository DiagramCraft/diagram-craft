import { UndoableAction } from '@diagram-craft/model/undoManager';
import { Emitter, EventEmitter, EventKey, EventMap } from '@diagram-craft/utils/event';
import { Point } from '@diagram-craft/geometry/point';
import { model } from './modelState';

export type ActionEvents = {
  /**
   * This event is emitted when the action is enabled or disabled.
   */
  // biome-ignore lint/suspicious/noExplicitAny: false positive
  actionChanged: { action?: Action<any> };

  /**
   * This event is emitted when the action is triggered.
   */
  // biome-ignore lint/suspicious/noExplicitAny: false positive
  actionTriggered: { action?: Action<any> };
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
  description?: string;
  availableInCommandPalette: boolean;
}

// biome-ignore lint/suspicious/noExplicitAny: false positive
export class ActionCriteria<T extends EventMap = any> {
  private triggerCallback: { (): void } | undefined;

  static Simple(callback: () => boolean): ActionCriteria {
    return new ActionCriteria(callback);
  }

  static EventTriggered<T extends EventMap>(
    target: EventEmitter<T>,
    k: EventKey<T>,
    callback: () => boolean
  ) {
    return new ActionCriteria<T>(callback, target, k);
  }

  constructor(
    public readonly callback: () => boolean,
    public readonly target?: EventEmitter<T>,
    public readonly eventName?: EventKey<T>
  ) {}

  attach(cb: () => void) {
    if (this.target) {
      this.target.on(this.eventName!, cb);
      this.triggerCallback = cb;
    }
  }

  detach() {
    if (this.target && this.triggerCallback) {
      this.target.off(this.eventName!, this.triggerCallback);
    }
  }
}

export abstract class AbstractAction<T = undefined, C extends ActionContext = ActionContext>
  extends EventEmitter<ActionEvents>
  implements Action<T>
{
  private criteria: Array<ActionCriteria> = [];
  private enabled: boolean = true;
  protected context: C;

  description?: string = undefined;
  availableInCommandPalette: boolean = true;

  constructor(context: C) {
    super();
    this.context = context;

    this.context.model.on('activeDiagramChange', () => this.bindCriteria());
    this.context.model.on('activeDocumentChange', () => this.bindCriteria());
  }

  isEnabled(_arg: Partial<T> | T): boolean {
    return this.enabled;
  }

  getCriteria(_context: C): Array<ActionCriteria> | ActionCriteria {
    return [];
  }

  abstract execute(arg: Partial<T>): void;

  bindCriteria() {
    for (const c of this.criteria) {
      c.detach();
    }

    const criteria = this.getCriteria(this.context);
    this.criteria = Array.isArray(criteria) ? criteria : [criteria];

    for (const c of this.criteria) {
      c.attach(() => this.evaluateCriteria());
    }
    this.evaluateCriteria();
  }

  private evaluateCriteria() {
    const result = this.criteria.reduce((acc, criterion) => acc && criterion.callback(), true);
    if (result === this.enabled) return;

    this.enabled = result;
    this.emit('actionChanged');
  }
}

export abstract class AbstractToggleAction<T = undefined, C extends ActionContext = ActionContext>
  extends AbstractAction<T, C>
  implements ToggleAction<T>
{
  private stateCriteria: Array<ActionCriteria> = [];
  protected state: boolean = false;

  public constructor(context: C) {
    super(context);
    this.context = context;

    this.context.model.on('activeDiagramChange', () => this.bindStateCriteria());
    this.context.model.on('activeDocumentChange', () => this.bindStateCriteria());
    this.bindStateCriteria();
  }

  getStateCriteria(_context: C): ActionCriteria[] | ActionCriteria {
    return [];
  }

  getState(_arg: Partial<T>): boolean {
    return this.state;
  }

  bindStateCriteria() {
    for (const c of this.stateCriteria) {
      c.detach();
    }

    const criteria = this.getStateCriteria(this.context);
    this.stateCriteria = Array.isArray(criteria) ? criteria : [criteria];

    for (const c of this.stateCriteria) {
      c.attach(() => this.evaluateStateCriteria());
    }
    this.evaluateStateCriteria();
  }

  private evaluateStateCriteria() {
    const result = this.stateCriteria.reduce((acc, criterion) => acc && criterion.callback(), true);
    if (result === this.state) return;

    this.state = result;
    this.emit('actionChanged', { action: this });
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
