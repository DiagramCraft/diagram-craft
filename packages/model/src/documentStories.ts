import { CRDTMap, CRDTRoot } from './collaboration/crdt';
import type { DiagramDocument } from './diagramDocument';
import type { EmptyObject } from '@diagram-craft/utils/types';
import { EventEmitter } from '@diagram-craft/utils/event';
import { newid } from '@diagram-craft/utils/id';
import { assert, mustExist } from '@diagram-craft/utils/assert';
import {
  MappedCRDTOrderedMap,
  type MappedCRDTOrderedMapMapType
} from './collaboration/datatypes/mapped/mappedCrdtOrderedMap';
import { type CRDTMapper } from './collaboration/datatypes/mapped/types';
import { watch } from '@diagram-craft/utils/watchableValue';

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
  steps: Step[];
};

type StoredStory = {
  id: string;
  name: string;
  steps: StoredStep[];
};

type StoredStep = {
  id: string;
  title: string;
  description: string;
  actions: StoryAction[];
};

const makeStoryMapper = (document: DiagramDocument): CRDTMapper<Story, CRDTMap<StoredStory>> => {
  return {
    fromCRDT(crdt: CRDTMap<StoredStory>): Story {
      return {
        id: crdt.get('id')!,
        name: crdt.get('name')!,
        steps: crdt.get('steps')!
      };
    },
    toCRDT(story: Story): CRDTMap<StoredStory> {
      const map = document.root.factory.makeMap<StoredStory>();
      map.set('id', story.id);
      map.set('name', story.name);
      map.set('steps', story.steps);
      return map;
    }
  };
};

export type DocumentStoriesEvents = {
  change: EmptyObject;
};

export class DocumentStories extends EventEmitter<DocumentStoriesEvents> {
  #stories: MappedCRDTOrderedMap<Story, StoredStory>;

  constructor(root: CRDTRoot, document: DiagramDocument) {
    super();
    const storiesMap = root.getMap<MappedCRDTOrderedMapMapType<StoredStory>>('stories');
    this.#stories = new MappedCRDTOrderedMap(watch(storiesMap), makeStoryMapper(document));
  }

  get stories(): Story[] {
    return this.#stories.values;
  }

  getStory(id: string): Story | undefined {
    return this.#stories.get(id);
  }

  addStory(name: string): Story {
    const story: Story = {
      id: newid(),
      name,
      steps: []
    };

    this.#stories.add(story.id, story);
    this.emitAsync('change');
    return story;
  }

  updateStory(story: Story, updates: { name?: string }) {
    const updatedStory: Story = {
      ...story,
      name: updates.name ?? story.name
    };

    this.#stories.update(story.id, updatedStory);
    this.emitAsync('change');
  }

  deleteStory(story: Story) {
    this.#stories.remove(story.id);
    this.emitAsync('change');
  }

  addStep(story: Story, title: string, description: string): Step {
    const step: Step = {
      id: newid(),
      title,
      description,
      actions: []
    };

    story.steps.push(step);

    this.#stories.update(story.id, story);
    this.emitAsync('change');
    return step;
  }

  updateStep(story: Story, step: Step, updates: { title?: string; description?: string }) {
    const stepIndex = story.steps.findIndex(s => s.id === step.id);
    assert.true(stepIndex >= 0);

    step.title = updates.title ?? step.title;
    step.description = updates.description ?? step.description;

    story.steps[stepIndex] = step;

    this.#stories.update(story.id, story);
    this.emitAsync('change');
  }

  deleteStep(story: Story, step: Step) {
    story.steps = story.steps.filter(s => s.id !== step.id);

    this.#stories.update(story.id, story);
    this.emitAsync('change');
  }

  addAction(story: Story, step: Step, action: StoryAction) {
    const stepIndex = story.steps.findIndex(s => s.id === step.id);
    assert.true(stepIndex >= 0);

    const currentStep = mustExist(story.steps[stepIndex]);
    currentStep.actions.push(action);

    story.steps[stepIndex] = currentStep;

    this.#stories.update(story.id, story);
    this.emitAsync('change');
  }

  removeAction(story: Story, step: Step, actionIndex: number) {
    const stepIndex = story.steps.findIndex(s => s.id === step.id);
    assert.true(stepIndex >= 0);

    const currentStep = mustExist(story.steps[stepIndex]);
    if (actionIndex < 0 || actionIndex >= currentStep.actions.length) return;

    step.actions = currentStep.actions.filter((_, i) => i !== actionIndex);

    story.steps[stepIndex] = currentStep;

    this.#stories.update(story.id, story);
    this.emitAsync('change');
  }

  clearActions(story: Story, step: Step) {
    // Remove all existing actions
    for (let i = step.actions.length - 1; i >= 0; i--) {
      this.removeAction(story, step, i);
    }
  }
}
