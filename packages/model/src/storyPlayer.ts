import type { DiagramDocument } from './diagramDocument';
import type { Step, Story, StoryAction } from './documentStories';
import { EventEmitter } from '@diagram-craft/utils/event';
import type { Diagram } from './diagram';
import { assert } from '@diagram-craft/utils/assert';

type StoryPlayerEvents = {
  stateChange: {
    currentStepIndex: number;
    story: Story | undefined;
  };
};

type SavedState = {
  diagramId: string;
  layerVisibility: Map<string, boolean>;
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

  constructor(
    private readonly document: DiagramDocument,
    private readonly switchDiagramCallback: (diagram: Diagram) => void
  ) {
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

  loadStory(story: Story) {
    this.#currentStory = story;
    this.#currentStepIndex = -1;
    this.emitStateChange();
  }

  start(diagram: Diagram) {
    assert.present(this.#currentStory);

    this.saveCurrentState(diagram);
    this.next();
  }

  stop() {
    this.#currentStepIndex = -1;
    this.restoreSavedState();
    this.emitStateChange();
  }

  next(): boolean {
    assert.present(this.#currentStory);

    if (this.#currentStepIndex >= this.#currentStory.steps.length - 1) {
      return false;
    }

    this.#currentStepIndex++;
    const step = this.#currentStory.steps[this.#currentStepIndex];
    if (step) {
      this.executeStep(step);
    }
    this.emitStateChange();
    return true;
  }

  previous(): boolean {
    assert.present(this.#currentStory);

    if (this.#currentStepIndex <= 0) return false;

    this.#currentStepIndex--;
    const step = this.#currentStory.steps[this.#currentStepIndex];
    if (step) {
      this.executeStep(step);
    }
    this.emitStateChange();
    return true;
  }

  goToStep(stepIndex: number) {
    assert.present(this.#currentStory);
    assert.true(stepIndex >= 0 && stepIndex < this.#currentStory.steps.length);

    for (let i = 0; i <= stepIndex; i++) {
      const step = this.#currentStory.steps[i];
      if (step) {
        this.executeStep(step);
      }
    }

    this.emitStateChange();
  }

  private executeStep(step: Step) {
    for (const action of step.actions) {
      this.executeAction(action);
    }
  }

  executeAction(action: StoryAction) {
    switch (action.type) {
      case 'switch-diagram': {
        const diagram = this.document.byId(action.diagramId);
        if (diagram) {
          this.switchDiagramCallback(diagram);
        } else {
          throw new Error(`Diagram ${action.diagramId} not found`);
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
          throw new Error(`Diagram ${action.diagramId} not found`);
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
          throw new Error(`Diagram ${action.diagramId} not found`);
        }
        break;
      }
      case 'pan-zoom': {
        const diagram = this.document.byId(action.diagramId);
        if (diagram) {
          const currentZoom = diagram.viewBox.zoomLevel;
          const targetZoom = action.zoom;
          const zoomFactor = targetZoom / currentZoom;

          diagram.viewBox.zoom(zoomFactor);
          diagram.viewBox.pan({ x: action.x, y: action.y });
        } else {
          throw new Error(`Diagram ${action.diagramId} not found`);
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

  private saveCurrentState(currentDiagram: Diagram) {
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
    assert.present(diagram);

    // Restore diagram
    this.switchDiagramCallback(diagram);

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

    // Clear saved state
    this.#savedState = undefined;
  }
}
