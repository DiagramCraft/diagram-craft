import type { DiagramDocument } from './diagramDocument';
import type { Story, StoryAction } from './documentStories';
import { EventEmitter } from '@diagram-craft/utils/event';

export type StoryPlayerEvents = {
  stateChange: {
    currentStepIndex: number;
    story: Story | undefined;
  };
};

type SavedState = {
  diagramId: string;
  layerVisibility: Map<string, boolean>; // layerId -> isVisible
  viewBox: {
    x: number;
    y: number;
    zoom: number;
  };
};

export class StoryPlayer extends EventEmitter<StoryPlayerEvents> {
  #currentStory: Story | undefined;
  #currentStepIndex = -1;
  #savedState: SavedState | undefined;

  constructor(private readonly document: DiagramDocument) {
    super();
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

  get savedDiagramId() {
    return this.#savedState?.diagramId;
  }

  loadStory(storyId: string) {
    const story = this.document.stories.getStory(storyId);
    if (!story) {
      console.warn(`Story ${storyId} not found`);
      return;
    }

    this.#currentStory = story;
    this.#currentStepIndex = -1;
    this.emitStateChange();
  }

  start(currentDiagramId?: string) {
    if (!this.#currentStory) return;

    // Save current state before starting playback
    if (this.#currentStepIndex === -1 && currentDiagramId) {
      this.saveCurrentState(currentDiagramId);
    }

    if (this.#currentStepIndex === -1) {
      this.next();
    } else {
      this.emitStateChange();
    }
  }

  stop() {
    this.#currentStepIndex = -1;

    // Restore the saved state
    this.restoreSavedState();

    this.emitStateChange();
  }

  next(): boolean {
    if (!this.#currentStory) return false;
    if (this.#currentStepIndex >= this.#currentStory.steps.length - 1) {
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
          // Calculate relative zoom factor to reach the absolute zoom level
          const currentZoom = diagram.viewBox.zoomLevel;
          const targetZoom = action.zoom;
          const zoomFactor = targetZoom / currentZoom;

          diagram.viewBox.zoom(zoomFactor);
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
      currentStepIndex: this.#currentStepIndex,
      story: this.#currentStory
    });
  }

  private saveCurrentState(diagramId: string) {
    const currentDiagram = this.document.byId(diagramId);
    if (!currentDiagram) return;

    const layerVisibility = new Map<string, boolean>();
    for (const layer of currentDiagram.layers.all) {
      layerVisibility.set(layer.id, currentDiagram.layers.visible.includes(layer));
    }

    this.#savedState = {
      diagramId: currentDiagram.id,
      layerVisibility,
      viewBox: {
        x: currentDiagram.viewBox.offset.x,
        y: currentDiagram.viewBox.offset.y,
        zoom: currentDiagram.viewBox.zoomLevel
      }
    };
  }

  private restoreSavedState() {
    if (!this.#savedState) return;

    const diagram = this.document.byId(this.#savedState.diagramId);
    if (!diagram) return;

    // Restore layer visibility
    for (const layer of diagram.layers.all) {
      const wasVisible = this.#savedState.layerVisibility.get(layer.id);
      const isVisible = diagram.layers.visible.includes(layer);

      if (wasVisible !== undefined && wasVisible !== isVisible) {
        diagram.layers.toggleVisibility(layer);
      }
    }

    // Restore pan/zoom
    const currentZoom = diagram.viewBox.zoomLevel;
    const targetZoom = this.#savedState.viewBox.zoom;
    const zoomFactor = targetZoom / currentZoom;

    diagram.viewBox.zoom(zoomFactor);
    diagram.viewBox.pan({ x: this.#savedState.viewBox.x, y: this.#savedState.viewBox.y });

    // Clear saved state after restoration
    this.#savedState = undefined;
  }
}
