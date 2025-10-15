import { describe, test, expect } from 'vitest';
import type { StoryAction } from './documentStories';
import { Backends, standardTestModel } from './collaboration/collaborationTestUtils';

describe.each(Backends.all())('DocumentStories - %s', (_name, backend) => {
  test('should replicate story creation', () => {
    const { doc1, doc2 } = standardTestModel(backend);

    const stories1 = doc1.stories;
    const stories2 = doc2?.stories;

    // Add a story in instance 1
    const story = stories1.addStory('My Story', 'A test story');

    expect(stories1.stories).toHaveLength(1);
    expect(stories1.stories[0]?.name).toBe('My Story');
    expect(stories1.stories[0]?.description).toBe('A test story');

    // Verify it replicates to instance 2
    if (stories2) {
      expect(stories2.stories).toHaveLength(1);
      expect(stories2.stories[0]?.id).toBe(story.id);
      expect(stories2.stories[0]?.name).toBe('My Story');
      expect(stories2.stories[0]?.description).toBe('A test story');
    }
  });

  test('should replicate story updates', () => {
    const { doc1, doc2 } = standardTestModel(backend);

    const stories1 = doc1.stories;
    const stories2 = doc2?.stories;

    // Create a story
    const story1 = stories1.addStory('Original Name', 'Original Description');

    // Update the story in instance 1
    stories1.updateStory(story1, { name: 'Updated Name', description: 'Updated Description' });

    // Get the updated story from instance 1
    const updatedStory1 = stories1.getStory(story1.id)!;
    expect(updatedStory1.name).toBe('Updated Name');
    expect(updatedStory1.description).toBe('Updated Description');

    // Verify it replicates to instance 2
    if (stories2) {
      const story2 = stories2.getStory(story1.id)!;
      expect(story2.name).toBe('Updated Name');
      expect(story2.description).toBe('Updated Description');
    }
  });

  test('should replicate story deletion', () => {
    const { doc1, doc2 } = standardTestModel(backend);

    const stories1 = doc1.stories;
    const stories2 = doc2?.stories;

    // Add a story
    const story = stories1.addStory('To Delete', 'Will be deleted');

    expect(stories1.stories).toHaveLength(1);
    if (stories2) {
      expect(stories2.stories).toHaveLength(1);
    }

    // Delete the story from instance 1
    stories1.deleteStory(story);

    expect(stories1.stories).toHaveLength(0);
    if (stories2) {
      expect(stories2.stories).toHaveLength(0);
    }
  });

  test('should replicate multiple stories in order', () => {
    const { doc1, doc2 } = standardTestModel(backend);

    const stories1 = doc1.stories;
    const stories2 = doc2?.stories;

    // Add multiple stories
    const story1 = stories1.addStory('Story 1');
    const story2 = stories1.addStory('Story 2');
    const story3 = stories1.addStory('Story 3');

    // Verify order is maintained in both instances
    expect(stories1.stories).toHaveLength(3);
    expect(stories1.stories[0]?.id).toBe(story1.id);
    expect(stories1.stories[1]?.id).toBe(story2.id);
    expect(stories1.stories[2]?.id).toBe(story3.id);

    if (stories2) {
      expect(stories2.stories).toHaveLength(3);
      expect(stories2.stories[0]?.id).toBe(story1.id);
      expect(stories2.stories[1]?.id).toBe(story2.id);
      expect(stories2.stories[2]?.id).toBe(story3.id);
    }
  });

  test('should replicate step creation', () => {
    const { doc1, doc2 } = standardTestModel(backend);

    const stories1 = doc1.stories;
    const stories2 = doc2?.stories;

    // Add a story
    const story1 = stories1.addStory('Story with Steps');

    // Add a step to the story
    const step = stories1.addStep(story1, 'Step 1', 'First step');

    // Verify in instance 1
    const updatedStory1 = stories1.getStory(story1.id)!;
    expect(updatedStory1.steps).toHaveLength(1);
    expect(updatedStory1.steps[0]?.title).toBe('Step 1');
    expect(updatedStory1.steps[0]?.description).toBe('First step');

    // Verify replication to instance 2
    if (stories2) {
      const story2 = stories2.getStory(story1.id)!;
      expect(story2.steps).toHaveLength(1);
      expect(story2.steps[0]?.id).toBe(step.id);
      expect(story2.steps[0]?.title).toBe('Step 1');
      expect(story2.steps[0]?.description).toBe('First step');
    }
  });

  test('should replicate step updates', () => {
    const { doc1, doc2 } = standardTestModel(backend);

    const stories1 = doc1.stories;
    const stories2 = doc2?.stories;

    // Create story and step
    const story1 = stories1.addStory('Story');
    const step1 = stories1.addStep(story1, 'Original Title', 'Original Description');

    // Update the step
    const updatedStory1 = stories1.getStory(story1.id)!;
    stories1.updateStep(updatedStory1, step1, {
      title: 'Updated Title',
      description: 'Updated Description'
    });

    // Verify in instance 1
    const latestStory1 = stories1.getStory(story1.id)!;
    expect(latestStory1.steps[0]?.title).toBe('Updated Title');
    expect(latestStory1.steps[0]?.description).toBe('Updated Description');

    // Verify replication to instance 2
    if (stories2) {
      const story2 = stories2.getStory(story1.id)!;
      expect(story2.steps[0]?.title).toBe('Updated Title');
      expect(story2.steps[0]?.description).toBe('Updated Description');
    }
  });

  test('should replicate step deletion', () => {
    const { doc1, doc2 } = standardTestModel(backend);

    const stories1 = doc1.stories;
    const stories2 = doc2?.stories;

    // Create story with multiple steps
    const story1 = stories1.addStory('Story');
    const step1 = stories1.addStep(story1, 'Step 1', 'First');
    const updatedStory1 = stories1.getStory(story1.id)!;
    const step2 = stories1.addStep(updatedStory1, 'Step 2', 'Second');

    // Verify both steps exist
    let currentStory1 = stories1.getStory(story1.id)!;
    expect(currentStory1.steps).toHaveLength(2);
    if (stories2) {
      let story2 = stories2.getStory(story1.id)!;
      expect(story2.steps).toHaveLength(2);
    }

    // Delete the first step
    stories1.deleteStep(currentStory1, step1);

    // Verify deletion in instance 1
    currentStory1 = stories1.getStory(story1.id)!;
    expect(currentStory1.steps).toHaveLength(1);
    expect(currentStory1.steps[0]?.id).toBe(step2.id);

    // Verify replication to instance 2
    if (stories2) {
      const story2 = stories2.getStory(story1.id)!;
      expect(story2.steps).toHaveLength(1);
      expect(story2.steps[0]?.id).toBe(step2.id);
    }
  });

  test('should replicate action creation', () => {
    const { doc1, doc2 } = standardTestModel(backend);

    const stories1 = doc1.stories;
    const stories2 = doc2?.stories;

    // Create story and step
    const story1 = stories1.addStory('Story');
    const step1 = stories1.addStep(story1, 'Step 1', 'First step');

    // Add actions to the step
    const updatedStory1 = stories1.getStory(story1.id)!;
    const action1: StoryAction = {
      type: 'switch-diagram',
      diagramId: 'diagram-1'
    };
    const action2: StoryAction = {
      type: 'pan-zoom',
      diagramId: 'diagram-1',
      x: 100,
      y: 200,
      zoom: 1.5
    };

    stories1.addAction(updatedStory1, step1, action1);
    const latestStory1 = stories1.getStory(story1.id)!;
    stories1.addAction(latestStory1, step1, action2);

    // Verify in instance 1
    const currentStory1 = stories1.getStory(story1.id)!;
    expect(currentStory1.steps[0]?.actions).toHaveLength(2);
    expect(currentStory1.steps[0]?.actions[0]).toEqual(action1);
    expect(currentStory1.steps[0]?.actions[1]).toEqual(action2);

    // Verify replication to instance 2
    if (stories2) {
      const story2 = stories2.getStory(story1.id)!;
      expect(story2.steps[0]?.actions).toHaveLength(2);
      expect(story2.steps[0]?.actions[0]).toEqual(action1);
      expect(story2.steps[0]?.actions[1]).toEqual(action2);
    }
  });

  test('should replicate action removal', () => {
    const { doc1, doc2 } = standardTestModel(backend);

    const stories1 = doc1.stories;
    const stories2 = doc2?.stories;

    // Create story and step with actions
    const story1 = stories1.addStory('Story');
    const step1 = stories1.addStep(story1, 'Step 1', 'First step');

    let updatedStory1 = stories1.getStory(story1.id)!;
    const action1: StoryAction = { type: 'switch-diagram', diagramId: 'diagram-1' };
    const action2: StoryAction = {
      type: 'pan-zoom',
      diagramId: 'diagram-1',
      x: 100,
      y: 200,
      zoom: 1.5
    };
    const action3: StoryAction = { type: 'show-layer', diagramId: 'diagram-1', layerId: 'layer-1' };

    stories1.addAction(updatedStory1, step1, action1);
    updatedStory1 = stories1.getStory(story1.id)!;
    stories1.addAction(updatedStory1, step1, action2);
    updatedStory1 = stories1.getStory(story1.id)!;
    stories1.addAction(updatedStory1, step1, action3);

    // Verify all actions exist
    let currentStory1 = stories1.getStory(story1.id)!;
    expect(currentStory1.steps[0]?.actions).toHaveLength(3);
    if (stories2) {
      let story2 = stories2.getStory(story1.id)!;
      expect(story2.steps[0]?.actions).toHaveLength(3);
    }

    // Remove the middle action (index 1)
    stories1.removeAction(currentStory1, step1, 1);

    // Verify removal in instance 1
    currentStory1 = stories1.getStory(story1.id)!;
    expect(currentStory1.steps[0]?.actions).toHaveLength(2);
    expect(currentStory1.steps[0]?.actions[0]).toEqual(action1);
    expect(currentStory1.steps[0]?.actions[1]).toEqual(action3);

    // Verify replication to instance 2
    if (stories2) {
      const story2 = stories2.getStory(story1.id)!;
      expect(story2.steps[0]?.actions).toHaveLength(2);
      expect(story2.steps[0]?.actions[0]).toEqual(action1);
      expect(story2.steps[0]?.actions[1]).toEqual(action3);
    }
  });

  test('should handle concurrent story additions', () => {
    const { doc1, doc2 } = standardTestModel(backend);
    if (!doc2) return; // Skip if backend doesn't support collaboration

    const stories1 = doc1.stories;
    const stories2 = doc2.stories;

    // Add stories from both instances concurrently
    const story1 = stories1.addStory('Story from Instance 1');
    const story2 = stories2.addStory('Story from Instance 2');

    // Both instances should have both stories
    expect(stories1.stories).toHaveLength(2);
    expect(stories2.stories).toHaveLength(2);

    // Verify both stories are present in both instances
    const story1InInstance1 = stories1.getStory(story1.id);
    const story2InInstance1 = stories1.getStory(story2.id);
    const story1InInstance2 = stories2.getStory(story1.id);
    const story2InInstance2 = stories2.getStory(story2.id);

    expect(story1InInstance1).toBeDefined();
    expect(story2InInstance1).toBeDefined();
    expect(story1InInstance2).toBeDefined();
    expect(story2InInstance2).toBeDefined();
  });

  test('should handle complex story with multiple steps and actions', () => {
    const { doc1, doc2 } = standardTestModel(backend);

    const stories1 = doc1.stories;
    const stories2 = doc2?.stories;

    // Create a complex story with multiple steps and actions
    const story1 = stories1.addStory('Complex Story', 'A story with multiple steps');

    // Add first step with actions
    let updatedStory = stories1.getStory(story1.id)!;
    const step1 = stories1.addStep(updatedStory, 'Step 1', 'First step');
    updatedStory = stories1.getStory(story1.id)!;
    stories1.addAction(updatedStory, step1, { type: 'switch-diagram', diagramId: 'diagram-1' });
    updatedStory = stories1.getStory(story1.id)!;
    stories1.addAction(updatedStory, step1, {
      type: 'show-layer',
      diagramId: 'diagram-1',
      layerId: 'layer-1'
    });

    // Add second step with actions
    updatedStory = stories1.getStory(story1.id)!;
    const step2 = stories1.addStep(updatedStory, 'Step 2', 'Second step');
    updatedStory = stories1.getStory(story1.id)!;
    stories1.addAction(updatedStory, step2, {
      type: 'hide-layer',
      diagramId: 'diagram-1',
      layerId: 'layer-2'
    });
    updatedStory = stories1.getStory(story1.id)!;
    stories1.addAction(updatedStory, step2, {
      type: 'pan-zoom',
      diagramId: 'diagram-1',
      x: 50,
      y: 100,
      zoom: 2.0
    });

    // Add third step with actions
    updatedStory = stories1.getStory(story1.id)!;
    const step3 = stories1.addStep(updatedStory, 'Step 3', 'Third step');
    updatedStory = stories1.getStory(story1.id)!;
    stories1.addAction(updatedStory, step3, { type: 'switch-diagram', diagramId: 'diagram-2' });

    // Verify complete replication to instance 2
    if (stories2) {
      const story2 = stories2.getStory(story1.id)!;
      expect(story2.name).toBe('Complex Story');
      expect(story2.description).toBe('A story with multiple steps');
      expect(story2.steps).toHaveLength(3);

      // Verify step 1
      expect(story2.steps[0]?.title).toBe('Step 1');
      expect(story2.steps[0]?.actions).toHaveLength(2);
      expect(story2.steps[0]?.actions[0]?.type).toBe('switch-diagram');
      expect(story2.steps[0]?.actions[1]?.type).toBe('show-layer');

      // Verify step 2
      expect(story2.steps[1]?.title).toBe('Step 2');
      expect(story2.steps[1]?.actions).toHaveLength(2);
      expect(story2.steps[1]?.actions[0]?.type).toBe('hide-layer');
      expect(story2.steps[1]?.actions[1]?.type).toBe('pan-zoom');

      // Verify step 3
      expect(story2.steps[2]?.title).toBe('Step 3');
      expect(story2.steps[2]?.actions).toHaveLength(1);
      expect(story2.steps[2]?.actions[0]?.type).toBe('switch-diagram');
    }
  });

  test('should handle story with undefined description', () => {
    const { doc1, doc2 } = standardTestModel(backend);

    const stories1 = doc1.stories;
    const stories2 = doc2?.stories;

    // Add story without description
    const story1 = stories1.addStory('Story Without Description');

    expect(story1.description).toBeUndefined();

    // Verify replication
    if (stories2) {
      const story2 = stories2.getStory(story1.id)!;
      expect(story2.description).toBeUndefined();
    }

    // Update to add description
    stories1.updateStory(story1, { description: 'Now with description' });

    const updatedStory1 = stories1.getStory(story1.id)!;
    expect(updatedStory1.description).toBe('Now with description');

    if (stories2) {
      const updatedStory2 = stories2.getStory(story1.id)!;
      expect(updatedStory2.description).toBe('Now with description');
    }
  });
});
