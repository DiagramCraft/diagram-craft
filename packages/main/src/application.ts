import {
  application as baseApplication,
  BaseApplicationInterface
} from '@diagram-craft/canvas-app/application';
import { ApplicationTriggers } from '@diagram-craft/canvas/ApplicationTriggers';

class Application implements BaseApplicationInterface {
  constructor(private readonly base: typeof baseApplication) {}

  actions: Partial<ActionMap> = {};

  get model() {
    return this.base.model;
  }

  set model(model) {
    this.base.model = model;
  }

  get ui() {
    return this.base.ui;
  }

  set ui(triggers: ApplicationTriggers) {
    this.base.ui = triggers;
  }
}

export const application = new Application(baseApplication);
