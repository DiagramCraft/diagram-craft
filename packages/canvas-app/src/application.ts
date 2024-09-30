import { model } from '@diagram-craft/canvas/modelState';
import { ApplicationTriggers, Context, Help } from '@diagram-craft/canvas/ApplicationTriggers';
import { Observable } from '@diagram-craft/canvas/component/component';
import { ToolType } from '@diagram-craft/canvas/tool';

export interface BaseApplicationInterface<U extends ApplicationTriggers = ApplicationTriggers>
  extends Context {
  model: typeof model;
  ui: U;
}

export class Application implements BaseApplicationInterface {
  model = model;
  #ui: ApplicationTriggers | undefined;
  #help: Help | undefined;
  actions: Partial<ActionMap> = {};
  tool = new Observable<ToolType>('move');

  get ui() {
    return this.#ui!;
  }

  set ui(triggers: ApplicationTriggers) {
    this.#ui = triggers;
  }

  get help() {
    return this.#help!;
  }

  set help(triggers: Help) {
    this.#help = triggers;
  }
}
