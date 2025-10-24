import { beforeEach, describe, expect, Mock, test, vi } from 'vitest';
import { StoryPlayer } from './storyPlayer';
import { TestDiagramBuilder, TestModel } from './test-support/testModel';
import type { DiagramDocument } from './diagramDocument';
import type { Diagram } from './diagram';
import type { StoryAction } from './documentStories';

describe('StoryPlayer', () => {
  let document: DiagramDocument;
  let diagram1: Diagram;
  let diagram2: Diagram;
  let storyPlayer: StoryPlayer;
  let switchDiagramCallback: ReturnType<Mock>;

  beforeEach(() => {
    document = TestModel.newDocument();

    // Create two diagrams with layers
    const db1 = new TestDiagramBuilder(document, 'diagram1');
    db1.newLayer('layer1');
    document.addDiagram(db1);
    diagram1 = db1;

    const db2 = new TestDiagramBuilder(document, 'diagram2');
    document.addDiagram(db2);
    diagram2 = db2;

    switchDiagramCallback = vi.fn();
    storyPlayer = new StoryPlayer(document, switchDiagramCallback);
  });

  describe('initialization', () => {
    test('should start with empty state', () => {
      expect(storyPlayer.currentStory).toBeUndefined();
      expect(storyPlayer.currentStepIndex).toBe(-1);
      expect(storyPlayer.currentStep).toBeUndefined();
    });
  });

  describe('loadStory()', () => {
    test('should load a story from the document', () => {
      const story = document.stories.addStory('Test Story');

      storyPlayer.loadStory(story);

      expect(storyPlayer.currentStory).toEqual(story);
    });

    test('should reset step index to -1 when loading a story', () => {
      const story = document.stories.addStory('Test Story');

      storyPlayer.loadStory(story);

      expect(storyPlayer.currentStepIndex).toBe(-1);
    });

    test('should emit stateChange event when loading a story', () => {
      const story = document.stories.addStory('Test Story');

      const listener = vi.fn();
      storyPlayer.on('stateChange', listener);

      storyPlayer.loadStory(story);

      expect(listener).toHaveBeenCalledWith({
        currentStepIndex: -1,
        story: expect.objectContaining({ id: story.id, name: 'Test Story' })
      });
    });
  });

  describe('start()', () => {
    test('should save current state and advance to first step', () => {
      const story = document.stories.addStory('Test Story');
      document.stories.addStep(story, 'Step 1', 'First step');

      storyPlayer.loadStory(story);
      storyPlayer.start(diagram1);

      expect(storyPlayer.currentStepIndex).toBe(0);
    });

    test('should save and restore diagram state including layer visibility', () => {
      const story = document.stories.addStory('Test Story');
      const step = document.stories.addStep(story, 'Step 1', 'First step');

      const hideAction: StoryAction = {
        type: 'hide-layer',
        diagramId: diagram1.id,
        layerId: diagram1.layers.all[0]!.id
      };
      document.stories.addAction(story, step, hideAction);

      const layer = diagram1.layers.all[0]!;
      const wasVisible = diagram1.layers.visible.includes(layer);

      storyPlayer.loadStory(story);
      storyPlayer.start(diagram1);

      // Layer should be hidden after start
      const isHiddenAfterStart = !diagram1.layers.visible.includes(layer);
      expect(isHiddenAfterStart).toBe(true);

      // After stop, state should be restored
      storyPlayer.stop();
      const isVisibleAfterStop = diagram1.layers.visible.includes(layer);
      expect(isVisibleAfterStop).toBe(wasVisible);
    });

    test('should save and restore viewBox state', () => {
      const story = document.stories.addStory('Test Story');
      document.stories.addStep(story, 'Step 1', 'First step');

      const originalOffset = { ...diagram1.viewBox.offset };
      const originalZoom = diagram1.viewBox.zoomLevel;

      storyPlayer.loadStory(story);
      storyPlayer.start(diagram1);

      // Manually change viewBox
      diagram1.viewBox.zoom(2);
      diagram1.viewBox.pan({ x: 100, y: 200 });

      // Stop should restore original state
      storyPlayer.stop();

      expect(diagram1.viewBox.offset).toEqual(originalOffset);
      expect(diagram1.viewBox.zoomLevel).toBe(originalZoom);
    });
  });

  describe('next()', () => {
    test('should advance to the next step', () => {
      const story = document.stories.addStory('Test Story');
      document.stories.addStep(story, 'Step 1', '');
      document.stories.addStep(story, 'Step 2', '');

      storyPlayer.loadStory(story);
      storyPlayer.start(diagram1);

      expect(storyPlayer.currentStepIndex).toBe(0);

      const result = storyPlayer.next();

      expect(result).toBe(true);
      expect(storyPlayer.currentStepIndex).toBe(1);
    });

    test('should return false when at the last step', () => {
      const story = document.stories.addStory('Test Story');
      document.stories.addStep(story, 'Step 1', '');

      storyPlayer.loadStory(story);
      storyPlayer.start(diagram1);

      const result = storyPlayer.next();

      expect(result).toBe(false);
      expect(storyPlayer.currentStepIndex).toBe(0);
    });

    test('should emit stateChange event', () => {
      const story = document.stories.addStory('Test Story');
      document.stories.addStep(story, 'Step 1', '');
      document.stories.addStep(story, 'Step 2', '');

      storyPlayer.loadStory(story);
      storyPlayer.start(diagram1);

      const listener = vi.fn();
      storyPlayer.on('stateChange', listener);

      storyPlayer.next();

      expect(listener).toHaveBeenCalledWith({
        currentStepIndex: 1,
        story: expect.objectContaining({ id: story.id })
      });
    });

    test('should throw error if no story is loaded', () => {
      expect(() => storyPlayer.next()).toThrow();
    });
  });

  describe('previous()', () => {
    test('should go back to the previous step', () => {
      const story = document.stories.addStory('Test Story');
      document.stories.addStep(story, 'Step 1', '');
      document.stories.addStep(story, 'Step 2', '');

      storyPlayer.loadStory(story);
      storyPlayer.start(diagram1);
      storyPlayer.next();

      expect(storyPlayer.currentStepIndex).toBe(1);

      const result = storyPlayer.previous();

      expect(result).toBe(true);
      expect(storyPlayer.currentStepIndex).toBe(0);
    });

    test('should return false when at the first step', () => {
      const story = document.stories.addStory('Test Story');
      document.stories.addStep(story, 'Step 1', '');

      storyPlayer.loadStory(story);
      storyPlayer.start(diagram1);

      const result = storyPlayer.previous();

      expect(result).toBe(false);
      expect(storyPlayer.currentStepIndex).toBe(0);
    });

    test('should emit stateChange event', () => {
      const story = document.stories.addStory('Test Story');
      document.stories.addStep(story, 'Step 1', '');
      document.stories.addStep(story, 'Step 2', '');

      storyPlayer.loadStory(story);
      storyPlayer.start(diagram1);
      storyPlayer.next();

      const listener = vi.fn();
      storyPlayer.on('stateChange', listener);

      storyPlayer.previous();

      expect(listener).toHaveBeenCalledWith({
        currentStepIndex: 0,
        story: expect.objectContaining({ id: story.id })
      });
    });

    test('should throw error if no story is loaded', () => {
      expect(() => storyPlayer.previous()).toThrow();
    });
  });

  describe('goToStep()', () => {
    test('should execute all actions up to and including the target step', () => {
      const story = document.stories.addStory('Test Story');
      document.stories.addStep(story, 'Step 1', '');
      document.stories.addStep(story, 'Step 2', '');
      document.stories.addStep(story, 'Step 3', '');

      storyPlayer.loadStory(story);

      // goToStep executes all steps but doesn't update currentStepIndex
      storyPlayer.goToStep(2);

      expect(storyPlayer.currentStepIndex).toBe(2);
    });

    test('should execute all actions up to the target step', () => {
      const story = document.stories.addStory('Test Story');
      const step1 = document.stories.addStep(story, 'Step 1', '');
      document.stories.addAction(story, step1, {
        type: 'switch-diagram',
        diagramId: diagram1.id
      });

      const step2 = document.stories.addStep(story, 'Step 2', '');
      document.stories.addAction(story, step2, {
        type: 'switch-diagram',
        diagramId: diagram2.id
      });

      storyPlayer.loadStory(story);
      storyPlayer.goToStep(1);

      // Both diagrams should have been switched to
      expect(switchDiagramCallback).toHaveBeenCalledWith(diagram1);
      expect(switchDiagramCallback).toHaveBeenCalledWith(diagram2);
      expect(switchDiagramCallback).toHaveBeenCalledTimes(2);
    });

    test('should throw error if step index is out of bounds', () => {
      const story = document.stories.addStory('Test Story');
      document.stories.addStep(story, 'Step 1', '');

      storyPlayer.loadStory(story);

      expect(() => storyPlayer.goToStep(5)).toThrow();
    });

    test('should throw error if no story is loaded', () => {
      expect(() => storyPlayer.goToStep(0)).toThrow();
    });
  });

  describe('stop()', () => {
    test('should reset step index to -1', () => {
      const story = document.stories.addStory('Test Story');
      document.stories.addStep(story, 'Step 1', '');

      storyPlayer.loadStory(story);
      storyPlayer.start(diagram1);

      expect(storyPlayer.currentStepIndex).toBe(0);

      storyPlayer.stop();

      expect(storyPlayer.currentStepIndex).toBe(-1);
    });

    test('should restore saved diagram state', () => {
      const story = document.stories.addStory('Test Story');
      const step = document.stories.addStep(story, 'Step 1', '');
      document.stories.addAction(story, step, {
        type: 'switch-diagram',
        diagramId: diagram2.id
      });

      storyPlayer.loadStory(story);
      storyPlayer.start(diagram1);

      // Switched to diagram2
      expect(switchDiagramCallback).toHaveBeenCalledWith(diagram2);

      storyPlayer.stop();

      // Should switch back to diagram1
      expect(switchDiagramCallback).toHaveBeenCalledWith(diagram1);
    });

    test('should emit stateChange event', () => {
      const story = document.stories.addStory('Test Story');
      document.stories.addStep(story, 'Step 1', '');

      storyPlayer.loadStory(story);
      storyPlayer.start(diagram1);

      const listener = vi.fn();
      storyPlayer.on('stateChange', listener);

      storyPlayer.stop();

      expect(listener).toHaveBeenCalledWith({
        currentStepIndex: -1,
        story: expect.objectContaining({ id: story.id })
      });
    });
  });

  describe('executeAction() - switch-diagram', () => {
    test('should switch to a different diagram', () => {
      const action: StoryAction = {
        type: 'switch-diagram',
        diagramId: diagram2.id
      };

      storyPlayer.executeAction(action);

      expect(switchDiagramCallback).toHaveBeenCalledWith(diagram2);
    });

    test('should throw error if diagram is not found', () => {
      const action: StoryAction = {
        type: 'switch-diagram',
        diagramId: 'nonexistent'
      };

      expect(() => storyPlayer.executeAction(action)).toThrow('Diagram nonexistent not found');
    });
  });

  describe('executeAction() - hide-layer', () => {
    test('should hide a visible layer', () => {
      const layer = diagram1.layers.all[0]!;
      const wasVisible = diagram1.layers.visible.includes(layer);

      const action: StoryAction = {
        type: 'hide-layer',
        diagramId: diagram1.id,
        layerId: layer.id
      };

      storyPlayer.executeAction(action);

      const isVisible = diagram1.layers.visible.includes(layer);
      expect(isVisible).toBe(!wasVisible);
    });

    test('should not hide an already hidden layer', () => {
      const layer = diagram1.layers.all[0]!;

      // First hide the layer
      diagram1.layers.toggleVisibility(layer);
      const visibleCountBefore = diagram1.layers.visible.length;

      const action: StoryAction = {
        type: 'hide-layer',
        diagramId: diagram1.id,
        layerId: layer.id
      };

      storyPlayer.executeAction(action);

      // Should remain the same
      expect(diagram1.layers.visible.length).toBe(visibleCountBefore);
    });

    test('should throw error if diagram is not found', () => {
      const action: StoryAction = {
        type: 'hide-layer',
        diagramId: 'nonexistent',
        layerId: 'layer1'
      };

      expect(() => storyPlayer.executeAction(action)).toThrow('Diagram nonexistent not found');
    });
  });

  describe('executeAction() - show-layer', () => {
    test('should show a hidden layer', () => {
      const layer = diagram1.layers.all[0]!;

      // First hide the layer
      diagram1.layers.toggleVisibility(layer);
      const wasVisible = diagram1.layers.visible.includes(layer);

      const action: StoryAction = {
        type: 'show-layer',
        diagramId: diagram1.id,
        layerId: layer.id
      };

      storyPlayer.executeAction(action);

      const isVisible = diagram1.layers.visible.includes(layer);
      expect(isVisible).toBe(!wasVisible);
    });

    test('should not show an already visible layer', () => {
      const layer = diagram1.layers.all[0]!;
      const visibleCountBefore = diagram1.layers.visible.length;

      const action: StoryAction = {
        type: 'show-layer',
        diagramId: diagram1.id,
        layerId: layer.id
      };

      storyPlayer.executeAction(action);

      // Should remain the same
      expect(diagram1.layers.visible.length).toBe(visibleCountBefore);
    });

    test('should throw error if diagram is not found', () => {
      const action: StoryAction = {
        type: 'show-layer',
        diagramId: 'nonexistent',
        layerId: 'layer1'
      };

      expect(() => storyPlayer.executeAction(action)).toThrow('Diagram nonexistent not found');
    });
  });

  describe('executeAction() - pan-zoom', () => {
    test('should pan and zoom the diagram', () => {
      const action: StoryAction = {
        type: 'pan-zoom',
        diagramId: diagram1.id,
        x: 100,
        y: 200,
        zoom: 2
      };

      storyPlayer.executeAction(action);

      expect(diagram1.viewBox.zoomLevel).toBe(2);
      expect(diagram1.viewBox.offset).toEqual({ x: 100, y: 200 });
    });

    test('should calculate correct zoom factor', () => {
      diagram1.viewBox.zoom(0.5);
      const action: StoryAction = {
        type: 'pan-zoom',
        diagramId: diagram1.id,
        x: 50,
        y: 50,
        zoom: 2
      };

      storyPlayer.executeAction(action);

      expect(diagram1.viewBox.zoomLevel).toBe(2);
    });

    test('should throw error if diagram is not found', () => {
      const action: StoryAction = {
        type: 'pan-zoom',
        diagramId: 'nonexistent',
        x: 0,
        y: 0,
        zoom: 1
      };

      expect(() => storyPlayer.executeAction(action)).toThrow('Diagram nonexistent not found');
    });
  });

  describe('currentStep', () => {
    test('should return undefined when no story is loaded', () => {
      expect(storyPlayer.currentStep).toBeUndefined();
    });

    test('should return undefined when step index is -1', () => {
      const story = document.stories.addStory('Test Story');
      document.stories.addStep(story, 'Step 1', '');

      storyPlayer.loadStory(story);

      expect(storyPlayer.currentStep).toBeUndefined();
    });

    test('should return the current step when playing', () => {
      const story = document.stories.addStory('Test Story');
      document.stories.addStep(story, 'Step 1', '');
      document.stories.addStep(story, 'Step 2', '');

      storyPlayer.loadStory(story);
      storyPlayer.start(diagram1);

      expect(storyPlayer.currentStep).toEqual(story.steps[0]);

      storyPlayer.next();

      expect(storyPlayer.currentStep).toEqual(story.steps[1]);
    });
  });
});
