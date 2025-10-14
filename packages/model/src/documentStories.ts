import { CRDTList, CRDTRoot } from './collaboration/crdt';
import type { DiagramDocument } from './diagramDocument';
import type { EmptyObject } from '@diagram-craft/utils/types';
import { EventEmitter } from '@diagram-craft/utils/event';
import { newid } from '@diagram-craft/utils/id';

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

type StoredStory = [string, string, string | undefined, Array<StoredStep>];
type StoredStep = [string, string, string, Array<StoryAction>];

export type DocumentStoriesEvents = {
  change: EmptyObject;
};

export class DocumentStories extends EventEmitter<DocumentStoriesEvents> {
  private _stories: CRDTList<StoredStory>;

  constructor(root: CRDTRoot, private readonly document: DiagramDocument) {
    super();
    this._stories = root.getList('stories');
  }

  get stories(): Story[] {
    return this._stories.toArray().map(s => ({
      id: s[0],
      name: s[1],
      description: s[2],
      steps: s[3].map(step => ({
        id: step[0],
        title: step[1],
        description: step[2],
        actions: step[3]
      }))
    }));
  }

  getStory(id: string): Story | undefined {
    const index = this._stories.toArray().findIndex(s => s[0] === id);
    if (index === -1) return undefined;

    const s = this._stories.get(index);
    return {
      id: s[0],
      name: s[1],
      description: s[2],
      steps: s[3].map(step => ({
        id: step[0],
        title: step[1],
        description: step[2],
        actions: step[3]
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

    const storedStory: StoredStory = [story.id, story.name, story.description, []];

    this._stories.push(storedStory);

    this.emitAsync('change');
    return story;
  }

  updateStory(id: string, updates: { name?: string; description?: string }) {
    const index = this._stories.toArray().findIndex(s => s[0] === id);
    if (index === -1) return;

    const story = this._stories.get(index);

    this.document.root.transact(() => {
      this._stories.delete(index);
      this._stories.insert(index, [
        [
          story[0],
          updates.name ?? story[1],
          updates.description === undefined ? story[2] : updates.description,
          story[3]
        ]
      ]);
    });

    this.emitAsync('change');
  }

  deleteStory(id: string) {
    const index = this._stories.toArray().findIndex(s => s[0] === id);
    if (index === -1) return;

    this.document.root.transact(() => {
      this._stories.delete(index);
    });

    this.emitAsync('change');
  }

  addStep(storyId: string, title: string, description: string): Step | undefined {
    const index = this._stories.toArray().findIndex(s => s[0] === storyId);
    if (index === -1) return undefined;

    const story = this._stories.get(index);
    const step: Step = {
      id: newid(),
      title,
      description,
      actions: []
    };

    const storedStep: StoredStep = [step.id, step.title, step.description, []];

    this.document.root.transact(() => {
      this._stories.delete(index);
      this._stories.insert(index, [[story[0], story[1], story[2], [...story[3], storedStep]]]);
    });

    this.emitAsync('change');
    return step;
  }

  updateStep(storyId: string, stepId: string, updates: { title?: string; description?: string }) {
    const storyIndex = this._stories.toArray().findIndex(s => s[0] === storyId);
    if (storyIndex === -1) return;

    const story = this._stories.get(storyIndex);
    const stepIndex = story[3].findIndex(s => s[0] === stepId);
    if (stepIndex === -1) return;

    const step = story[3][stepIndex];
    if (!step) return;

    const updatedStep: StoredStep = [
      step[0],
      updates.title ?? step[1],
      updates.description ?? step[2],
      step[3]
    ];

    this.document.root.transact(() => {
      this._stories.delete(storyIndex);
      this._stories.insert(storyIndex, [
        [story[0], story[1], story[2], story[3].toSpliced(stepIndex, 1, updatedStep)]
      ]);
    });

    this.emitAsync('change');
  }

  deleteStep(storyId: string, stepId: string) {
    const storyIndex = this._stories.toArray().findIndex(s => s[0] === storyId);
    if (storyIndex === -1) return;

    const story = this._stories.get(storyIndex);
    const stepIndex = story[3].findIndex(s => s[0] === stepId);
    if (stepIndex === -1) return;

    this.document.root.transact(() => {
      this._stories.delete(storyIndex);
      this._stories.insert(storyIndex, [
        [story[0], story[1], story[2], story[3].filter(s => s[0] !== stepId)]
      ]);
    });

    this.emitAsync('change');
  }

  addAction(storyId: string, stepId: string, action: StoryAction) {
    const storyIndex = this._stories.toArray().findIndex(s => s[0] === storyId);
    if (storyIndex === -1) return;

    const story = this._stories.get(storyIndex);
    const stepIndex = story[3].findIndex(s => s[0] === stepId);
    if (stepIndex === -1) return;

    const step = story[3][stepIndex];
    if (!step) return;

    const updatedStep: StoredStep = [step[0], step[1], step[2], [...step[3], action]];

    this.document.root.transact(() => {
      this._stories.delete(storyIndex);
      this._stories.insert(storyIndex, [
        [story[0], story[1], story[2], story[3].toSpliced(stepIndex, 1, updatedStep)]
      ]);
    });

    this.emitAsync('change');
  }

  removeAction(storyId: string, stepId: string, actionIndex: number) {
    const storyIndex = this._stories.toArray().findIndex(s => s[0] === storyId);
    if (storyIndex === -1) return;

    const story = this._stories.get(storyIndex);
    const stepIndex = story[3].findIndex(s => s[0] === stepId);
    if (stepIndex === -1) return;

    const step = story[3][stepIndex];
    if (!step) return;
    if (actionIndex < 0 || actionIndex >= step[3].length) return;

    const updatedStep: StoredStep = [
      step[0],
      step[1],
      step[2],
      step[3].filter((_, i) => i !== actionIndex)
    ];

    this.document.root.transact(() => {
      this._stories.delete(storyIndex);
      this._stories.insert(storyIndex, [
        [story[0], story[1], story[2], story[3].toSpliced(stepIndex, 1, updatedStep)]
      ]);
    });

    this.emitAsync('change');
  }

  moveStep(storyId: string, fromIndex: number, toIndex: number) {
    const storyIndex = this._stories.toArray().findIndex(s => s[0] === storyId);
    if (storyIndex === -1) return;

    const story = this._stories.get(storyIndex);
    if (fromIndex < 0 || fromIndex >= story[3].length) return;
    if (toIndex < 0 || toIndex >= story[3].length) return;

    const steps = [...story[3]];
    const movedStep = steps[fromIndex];
    if (!movedStep) return;

    steps.splice(fromIndex, 1);
    steps.splice(toIndex, 0, movedStep);

    this.document.root.transact(() => {
      this._stories.delete(storyIndex);
      this._stories.insert(storyIndex, [[story[0], story[1], story[2], steps]]);
    });

    this.emitAsync('change');
  }
}
