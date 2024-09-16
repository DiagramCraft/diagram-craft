import { model } from '@diagram-craft/canvas/modelState';
import { ApplicationTriggers } from '@diagram-craft/canvas/ApplicationTriggers';

export interface BaseApplicationInterface<U extends ApplicationTriggers = ApplicationTriggers> {
  model: typeof model;
  ui: U;
}

export class Application implements BaseApplicationInterface {
  model = model;
  #ui: ApplicationTriggers | undefined;

  get ui() {
    return this.#ui!;
  }

  set ui(triggers: ApplicationTriggers) {
    this.#ui = triggers;
  }
}
