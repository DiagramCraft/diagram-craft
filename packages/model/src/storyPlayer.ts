import type { DiagramDocument } from './diagramDocument';
import type { Story, StoryAction } from './documentStories';
import { EventEmitter } from '@diagram-craft/utils/event';

export type StoryPlayerEvents = {
  stateChange: {
    isPlaying: boolean;
    currentStepIndex: number;
    story: Story | undefined;
  };
};

export class StoryPlayer extends EventEmitter<StoryPlayerEvents> {
  #isPlaying = false;
  #currentStory: Story | undefined;
  #currentStepIndex = -1;

  constructor(private readonly document: DiagramDocument) {
    super();
  }

  get isPlaying() {
    return this.#isPlaying;
  }

  get currentStory() {
    return this.#currentStory;
  }

  get currentStepIndex() {
    return this.#currentStepIndex;
  }

  get currentStep() {
    if (!this.#currentStory || this.#currentStepIndex < 0) return undefined;
    return this.#currentStory.steps[this.#currentStepIndex];
  }

  loadStory(storyId: string) {
    const story = this.document.stories.getStory(storyId);
    if (!story) {
      console.warn(`Story ${storyId} not found`);
      return;
    }

    this.#currentStory = story;
    this.#currentStepIndex = -1;
    this.#isPlaying = false;
    this.emitStateChange();
  }

  play() {
    if (!this.#currentStory) return;
    this.#isPlaying = true;
    if (this.#currentStepIndex === -1) {
      this.next();
    } else {
      this.emitStateChange();
    }
  }

  pause() {
    this.#isPlaying = false;
    this.emitStateChange();
  }

  stop() {
    this.#isPlaying = false;
    this.#currentStepIndex = -1;
    this.emitStateChange();
  }

  next(): boolean {
    if (!this.#currentStory) return false;
    if (this.#currentStepIndex >= this.#currentStory.steps.length - 1) {
      this.#isPlaying = false;
      this.emitStateChange();
      return false;
    }

    this.#currentStepIndex++;
    const step = this.#currentStory.steps[this.#currentStepIndex];
    if (step) {
      this.executeStep(step.actions);
    }
    this.emitStateChange();
    return true;
  }

  previous(): boolean {
    if (!this.#currentStory) return false;
    if (this.#currentStepIndex <= 0) return false;

    this.#currentStepIndex--;
    const step = this.#currentStory.steps[this.#currentStepIndex];
    if (step) {
      this.executeStep(step.actions);
    }
    this.emitStateChange();
    return true;
  }

  goToStep(stepIndex: number) {
    if (!this.#currentStory) return;
    if (stepIndex < 0 || stepIndex >= this.#currentStory.steps.length) return;

    this.#currentStepIndex = stepIndex;
    const step = this.#currentStory.steps[this.#currentStepIndex];
    if (step) {
      this.executeStep(step.actions);
    }
    this.emitStateChange();
  }

  private executeStep(actions: StoryAction[]) {
    for (const action of actions) {
      this.executeAction(action);
    }
  }

  executeAction(action: StoryAction) {
    switch (action.type) {
      case 'switch-diagram': {
        const diagram = this.document.byId(action.diagramId);
        if (diagram) {
          // The actual switching is handled by the application layer
          // This event can be listened to by the UI
          this.emit('stateChange', {
            isPlaying: this.#isPlaying,
            currentStepIndex: this.#currentStepIndex,
            story: this.#currentStory
          });
        } else {
          console.warn(`Diagram ${action.diagramId} not found`);
        }
        break;
      }
      case 'hide-layer': {
        const diagram = this.document.byId(action.diagramId);
        if (diagram) {
          const layer = diagram.layers.byId(action.layerId);
          if (layer && diagram.layers.visible.includes(layer)) {
            diagram.layers.toggleVisibility(layer);
          }
        } else {
          console.warn(`Diagram ${action.diagramId} not found`);
        }
        break;
      }
      case 'show-layer': {
        const diagram = this.document.byId(action.diagramId);
        if (diagram) {
          const layer = diagram.layers.byId(action.layerId);
          if (layer && !diagram.layers.visible.includes(layer)) {
            diagram.layers.toggleVisibility(layer);
          }
        } else {
          console.warn(`Diagram ${action.diagramId} not found`);
        }
        break;
      }
      case 'pan-zoom': {
        const diagram = this.document.byId(action.diagramId);
        if (diagram) {
          diagram.viewBox.zoom(action.zoom);
          diagram.viewBox.pan({ x: action.x, y: action.y });
        } else {
          console.warn(`Diagram ${action.diagramId} not found`);
        }
        break;
      }
    }
  }

  private emitStateChange() {
    this.emit('stateChange', {
      isPlaying: this.#isPlaying,
      currentStepIndex: this.#currentStepIndex,
      story: this.#currentStory
    });
  }
}
