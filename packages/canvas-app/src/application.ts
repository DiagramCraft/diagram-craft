import { model } from '@diagram-craft/canvas/modelState';
import { UIActions, Context, Help } from '@diagram-craft/canvas/context';
import { Observable } from '@diagram-craft/canvas/component/component';
import { ToolType } from '@diagram-craft/canvas/tool';
import { Marquee } from '@diagram-craft/canvas/marquee';

export interface BaseApplicationInterface<U extends UIActions = UIActions> extends Context {
  model: typeof model;
  ui: U;
}

export class Application<U extends UIActions = UIActions> implements BaseApplicationInterface<U> {
  model = model;
  #ui: U | undefined;
  #help: Help | undefined;
  actions: Partial<ActionMap> = {};
  tool = new Observable<ToolType>('move');
  marquee = new Marquee();

  get ui() {
    return this.#ui!;
  }

  set ui(triggers: U) {
    this.#ui = triggers;
  }

  get help() {
    return this.#help!;
  }

  set help(triggers: Help) {
    this.#help = triggers;
  }
}
