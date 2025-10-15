import { CRDTList, CRDTRoot } from './collaboration/crdt';
import type { DiagramDocument } from './diagramDocument';
import type { EmptyObject } from '@diagram-craft/utils/types';
import { EventEmitter } from '@diagram-craft/utils/event';
import { newid } from '@diagram-craft/utils/id';
import { assert } from '@diagram-craft/utils/assert';

export type StoryAction =
  | {
      type: 'switch-diagram';
      diagramId: string;
    }
  | {
      type: 'hide-layer';
      diagramId: string;
      layerId: string;
    }
  | {
      type: 'show-layer';
      diagramId: string;
      layerId: string;
    }
  | {
      type: 'pan-zoom';
      diagramId: string;
      x: number;
      y: number;
      zoom: number;
    };

export type Step = {
  id: string;
  title: string;
  description: string;
  actions: StoryAction[];
};

export type Story = {
  id: string;
  name: string;
  description?: string;
  steps: Step[];
};

type StoredStory = {
  id: string;
  name: string;
  description: string | undefined;
  steps: StoredStep[];
};

type StoredStep = {
  id: string;
  title: string;
  description: string;
  actions: StoryAction[];
};

export type DocumentStoriesEvents = {
  change: EmptyObject;
};

export class DocumentStories extends EventEmitter<DocumentStoriesEvents> {
  #stories: CRDTList<StoredStory>;

  constructor(
    root: CRDTRoot,
    private readonly document: DiagramDocument
  ) {
    super();
    this.#stories = root.getList('stories');
  }

  get stories(): Story[] {
    return this.#stories.toArray().map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      steps: s.steps.map(step => ({
        id: step.id,
        title: step.title,
        description: step.description,
        actions: step.actions
      }))
    }));
  }

  getStory(id: string): Story | undefined {
    const index = this.#stories.toArray().findIndex(s => s.id === id);
    if (index === -1) return undefined;

    const s = this.#stories.get(index);
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      steps: s.steps.map(step => ({
        id: step.id,
        title: step.title,
        description: step.description,
        actions: step.actions
      }))
    };
  }

  addStory(name: string, description?: string): Story {
    const story: Story = {
      id: newid(),
      name,
      description,
      steps: []
    };

    const storedStory: StoredStory = {
      id: story.id,
      name: story.name,
      description: story.description,
      steps: []
    };

    this.#stories.push(storedStory);

    this.emitAsync('change');
    return story;
  }

  updateStory(story: Story, updates: { name?: string; description?: string }) {
    const index = this.#stories.toArray().findIndex(s => s.id === story.id);
    assert.true(index >= 0);

    const storedStory = this.#stories.get(index);

    this.document.root.transact(() => {
      this.#stories.delete(index);
      this.#stories.insert(index, [
        {
          id: storedStory.id,
          name: updates.name ?? storedStory.name,
          description:
            updates.description === undefined ? storedStory.description : updates.description,
          steps: storedStory.steps
        }
      ]);
    });

    this.emitAsync('change');
  }

  deleteStory(story: Story) {
    const index = this.#stories.toArray().findIndex(s => s.id === story.id);
    assert.true(index >= 0);

    this.document.root.transact(() => {
      this.#stories.delete(index);
    });

    this.emitAsync('change');
  }

  addStep(story: Story, title: string, description: string): Step {
    const index = this.#stories.toArray().findIndex(s => s.id === story.id);
    assert.true(index >= 0);

    const storedStory = this.#stories.get(index);
    const step: Step = {
      id: newid(),
      title,
      description,
      actions: []
    };

    const storedStep: StoredStep = {
      id: step.id,
      title: step.title,
      description: step.description,
      actions: []
    };

    this.document.root.transact(() => {
      this.#stories.delete(index);
      this.#stories.insert(index, [
        {
          id: storedStory.id,
          name: storedStory.name,
          description: storedStory.description,
          steps: [...storedStory.steps, storedStep]
        }
      ]);
    });

    this.emitAsync('change');
    return step;
  }

  updateStep(story: Story, step: Step, updates: { title?: string; description?: string }) {
    const storyIndex = this.#stories.toArray().findIndex(s => s.id === story.id);
    assert.true(storyIndex >= 0);

    const storedStory = this.#stories.get(storyIndex);
    const stepIndex = storedStory.steps.findIndex(s => s.id === step.id);
    assert.true(stepIndex >= 0);

    const storedStep = storedStory.steps[stepIndex];
    if (!storedStep) return;

    const updatedStep: StoredStep = {
      id: storedStep.id,
      title: updates.title ?? storedStep.title,
      description: updates.description ?? storedStep.description,
      actions: storedStep.actions
    };

    this.document.root.transact(() => {
      this.#stories.delete(storyIndex);
      this.#stories.insert(storyIndex, [
        {
          id: storedStory.id,
          name: storedStory.name,
          description: storedStory.description,
          steps: storedStory.steps.toSpliced(stepIndex, 1, updatedStep)
        }
      ]);
    });

    this.emitAsync('change');
  }

  deleteStep(story: Story, step: Step) {
    const storyIndex = this.#stories.toArray().findIndex(s => s.id === story.id);
    assert.true(storyIndex >= 0);

    const storedStory = this.#stories.get(storyIndex);
    const stepIndex = storedStory.steps.findIndex(s => s.id === step.id);
    assert.true(stepIndex >= 0);

    this.document.root.transact(() => {
      this.#stories.delete(storyIndex);
      this.#stories.insert(storyIndex, [
        {
          id: storedStory.id,
          name: storedStory.name,
          description: storedStory.description,
          steps: storedStory.steps.filter(s => s.id !== step.id)
        }
      ]);
    });

    this.emitAsync('change');
  }

  addAction(story: Story, step: Step, action: StoryAction) {
    const storyIndex = this.#stories.toArray().findIndex(s => s.id === story.id);
    assert.true(storyIndex >= 0);

    const storedStory = this.#stories.get(storyIndex);
    const stepIndex = storedStory.steps.findIndex(s => s.id === step.id);
    assert.true(stepIndex >= 0);

    const storedStep = storedStory.steps[stepIndex];
    if (!storedStep) return;

    const updatedStep: StoredStep = {
      id: storedStep.id,
      title: storedStep.title,
      description: storedStep.description,
      actions: [...storedStep.actions, action]
    };

    this.document.root.transact(() => {
      this.#stories.delete(storyIndex);
      this.#stories.insert(storyIndex, [
        {
          id: storedStory.id,
          name: storedStory.name,
          description: storedStory.description,
          steps: storedStory.steps.toSpliced(stepIndex, 1, updatedStep)
        }
      ]);
    });

    this.emitAsync('change');
  }

  removeAction(story: Story, step: Step, actionIndex: number) {
    const storyIndex = this.#stories.toArray().findIndex(s => s.id === story.id);
    assert.true(storyIndex >= 0);

    const storedStory = this.#stories.get(storyIndex);
    const stepIndex = storedStory.steps.findIndex(s => s.id === step.id);
    assert.true(stepIndex >= 0);

    const storedStep = storedStory.steps[stepIndex];
    if (!storedStep) return;
    if (actionIndex < 0 || actionIndex >= storedStep.actions.length) return;

    const updatedStep: StoredStep = {
      id: storedStep.id,
      title: storedStep.title,
      description: storedStep.description,
      actions: storedStep.actions.filter((_, i) => i !== actionIndex)
    };

    this.document.root.transact(() => {
      this.#stories.delete(storyIndex);
      this.#stories.insert(storyIndex, [
        {
          id: storedStory.id,
          name: storedStory.name,
          description: storedStory.description,
          steps: storedStory.steps.toSpliced(stepIndex, 1, updatedStep)
        }
      ]);
    });

    this.emitAsync('change');
  }
}
