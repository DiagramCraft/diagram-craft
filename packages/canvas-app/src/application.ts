import { model } from '@diagram-craft/canvas/modelState';
import { ApplicationTriggers } from '@diagram-craft/canvas/ApplicationTriggers';

export interface BaseApplicationInterface<U extends ApplicationTriggers = ApplicationTriggers> {
  model: typeof model;
  ui: U;
}

class BaseApplication implements BaseApplicationInterface {
  model = model;

  #ui: ApplicationTriggers | undefined;

  get ui() {
    return this.#ui!;
  }

  set ui(triggers: ApplicationTriggers) {
    this.#ui = triggers;
  }
}

export const application = new BaseApplication();
