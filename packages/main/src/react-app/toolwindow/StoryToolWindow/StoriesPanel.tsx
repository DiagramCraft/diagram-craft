import { Tree } from '@diagram-craft/app-components/Tree';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import {
  TbArrowRight,
  TbCapture,
  TbEye,
  TbEyeOff,
  TbFocus2,
  TbList,
  TbMovie,
  TbPlayerPlay,
  TbPlus,
  TbTrash
} from 'react-icons/tb';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { useApplication, useDiagram, useDocument } from '../../../application';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { useState } from 'react';
import type { Step, Story, StoryAction } from '@diagram-craft/model/documentStories';
import { useToolWindowControls } from '../ToolWindow';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import { assert, mustExist } from '@diagram-craft/utils/assert';
import type { Diagram } from '@diagram-craft/model/diagram';
import { TextArea } from '@diagram-craft/app-components/TextArea';

const recordCurrentState = (diagram: Diagram, story: Story, step: Step) => {
  const document = diagram.document;

  // 1. Switch to current diagram
  document.stories.addAction(story, step, {
    type: 'switch-diagram',
    diagramId: diagram.id
  });

  // 2. Record layer visibility state
  for (const layer of diagram.layers.all) {
    const isVisible = diagram.layers.visible.includes(layer);
    document.stories.addAction(story, step, {
      type: isVisible ? 'show-layer' : 'hide-layer',
      diagramId: diagram.id,
      layerId: layer.id
    });
  }

  // 3. Record pan/zoom state
  document.stories.addAction(story, step, {
    type: 'pan-zoom',
    diagramId: diagram.id,
    x: diagram.viewBox.offset.x,
    y: diagram.viewBox.offset.y,
    zoom: diagram.viewBox.zoomLevel
  });
};

const getStepDelta = (currentStep: Step, previousStep: Step | undefined): StoryAction[] => {
  // First step - show all actions
  if (!previousStep) {
    return currentStep.actions;
  }

  // Build a map of previous step's state
  const prevState = {
    diagram: previousStep.actions.find(a => a.type === 'switch-diagram')?.diagramId,
    layers: new Map<string, boolean>(),
    panZoom: previousStep.actions.find(a => a.type === 'pan-zoom') as
      | Extract<StoryAction, { type: 'pan-zoom' }>
      | undefined
  };

  // Record layer visibility from previous step
  for (const action of previousStep.actions) {
    if (action.type === 'show-layer') {
      prevState.layers.set(action.layerId, true);
    } else if (action.type === 'hide-layer') {
      prevState.layers.set(action.layerId, false);
    }
  }

  // Find changes in current step
  const delta: StoryAction[] = [];

  for (const action of currentStep.actions) {
    if (action.type === 'switch-diagram') {
      if (action.diagramId !== prevState.diagram) {
        delta.push(action);
      }
    } else if (action.type === 'show-layer' || action.type === 'hide-layer') {
      const prevVisibility = prevState.layers.get(action.layerId);
      const currentVisibility = action.type === 'show-layer';

      if (prevVisibility !== currentVisibility) {
        delta.push(action);
      }
    } else if (action.type === 'pan-zoom') {
      // Only show if pan/zoom changed
      const prev = prevState.panZoom;
      if (!prev || prev.x !== action.x || prev.y !== action.y || prev.zoom !== action.zoom) {
        delta.push(action);
      }
    }
  }

  return delta;
};

export const StoriesPanel = () => {
  const redraw = useRedraw();
  const document = useDocument();
  const diagram = useDiagram();
  const application = useApplication();
  const stories = document.stories.stories;
  const { switchTab } = useToolWindowControls();

  const [showNewStepDialog, setShowNewStepDialog] = useState(false);
  const [selectedStoryIdForNewStep, setSelectedStoryIdForNewStep] = useState<string | undefined>();
  const [newStepTitle, setNewStepTitle] = useState('');
  const [newStepDescription, setNewStepDescription] = useState('');

  useEventListener(document.stories, 'change', redraw);

  const handleAddStep = () => {
    if (selectedStoryIdForNewStep && newStepTitle.trim()) {
      const story = document.stories.getStory(selectedStoryIdForNewStep);
      assert.present(story);

      const step = document.stories.addStep(story, newStepTitle, newStepDescription);
      recordCurrentState(diagram, story, step);

      setNewStepTitle('');
      setNewStepDescription('');
      setShowNewStepDialog(false);
      setSelectedStoryIdForNewStep(undefined);
    }
  };

  const handleDeleteStep = (storyId: string, stepId: string) => {
    const story = mustExist(document.stories.getStory(storyId));
    const step = mustExist(story.steps.find(s => s.id === stepId));

    application.ui.showDialog(
      new MessageDialogCommand(
        {
          title: 'Confirm delete',
          message: `Are you sure you want to delete "${step.title}"? This action cannot be undone.`,
          okLabel: 'Yes',
          cancelLabel: 'No'
        },
        () => {
          document.stories.deleteStep(story, step);
        }
      )
    );
  };

  const handleDeleteStory = (storyId: string) => {
    const story = mustExist(document.stories.getStory(storyId));

    const stepCount = story.steps.length;

    application.ui.showDialog(
      new MessageDialogCommand(
        {
          title: 'Confirm delete',
          message: `Are you sure you want to delete "${story.name}"? This action cannot be undone.${stepCount > 0 ? ` This will also delete ${stepCount} step${stepCount !== 1 ? 's' : ''}.` : ''}`,
          okLabel: 'Yes',
          cancelLabel: 'No'
        },
        () => {
          document.stories.deleteStory(story);
        }
      )
    );
  };

  const handleReRecordStep = (storyId: string, stepId: string) => {
    const story = mustExist(document.stories.getStory(storyId));
    const step = mustExist(story.steps.find(s => s.id === stepId));

    document.stories.clearActions(story, step);

    // Record current state
    recordCurrentState(diagram, story, step);
  };

  const handlePlayStory = () => {
    switchTab('player');
  };

  const getActionDescription = (action: StoryAction): string => {
    const diagram = document.byId(action.diagramId);
    const diagramName = diagram?.name ?? 'Unknown';

    switch (action.type) {
      case 'switch-diagram':
        return `Activate: ${diagramName}`;
      case 'hide-layer': {
        const layer = diagram?.layers.byId(action.layerId);
        return `Hide: ${layer?.name ?? 'Unknown'} (${diagramName})`;
      }
      case 'show-layer': {
        const layer = diagram?.layers.byId(action.layerId);
        return `Show: ${layer?.name ?? 'Unknown'} (${diagramName})`;
      }
      case 'pan-zoom':
        return `Pan: (${action.x.toFixed(0)}, ${action.y.toFixed(0)}) @ ${(action.zoom * 100).toFixed(0)}%`;
    }
  };

  const getActionIcon = (action: StoryAction) => {
    switch (action.type) {
      case 'switch-diagram':
        return <TbArrowRight />;
      case 'hide-layer':
        return <TbEyeOff />;
      case 'show-layer':
        return <TbEye />;
      case 'pan-zoom':
        return <TbFocus2 />;
    }
  };

  return (
    <ToolWindowPanel
      mode={'headless-no-padding'}
      id={'stories'}
      title={'Stories'}
      style={{ padding: '0.25rem 0' }}
    >
      {stories.length === 0 && (
        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--base-fg-dim)' }}>
          No stories yet. Create one to get started.
        </div>
      )}
      {stories.length > 0 && (
        <Tree.Root className={'cmp-story-list'}>
          {stories.map(story => (
            <Tree.Node key={story.id} isOpen={true}>
              <Tree.NodeLabel>
                <TbMovie /> &nbsp;{story.name}
              </Tree.NodeLabel>
              <Tree.NodeCell className="cmp-tree__node__action">
                <span style={{ cursor: 'pointer' }} onClick={handlePlayStory} title="Play story">
                  <TbPlayerPlay />
                </span>
                <span
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setSelectedStoryIdForNewStep(story.id);
                    setShowNewStepDialog(true);
                  }}
                  title="Add step"
                >
                  <TbPlus />
                </span>
                <span
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleDeleteStory(story.id)}
                  title="Delete story"
                >
                  <TbTrash />
                </span>
              </Tree.NodeCell>
              <Tree.Children>
                {story.steps.length === 0 && (
                  <Tree.Node>
                    <Tree.NodeLabel style={{ fontStyle: 'italic', color: 'var(--base-fg-dim)' }}>
                      No steps yet
                    </Tree.NodeLabel>
                  </Tree.Node>
                )}
                {story.steps.map((step, stepIndex) => (
                  <Tree.Node key={step.id} isOpen={true}>
                    <Tree.NodeLabel>
                      <TbList /> &nbsp;{stepIndex + 1}. {step.title}
                    </Tree.NodeLabel>
                    <Tree.NodeCell className="cmp-tree__node__action">
                      <span
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleReRecordStep(story.id, step.id)}
                        title="Re-record current state"
                      >
                        <TbCapture />
                      </span>
                      <span
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleDeleteStep(story.id, step.id)}
                        title="Delete step"
                      >
                        <TbTrash />
                      </span>
                    </Tree.NodeCell>
                    <Tree.Children>
                      {(() => {
                        const previousStep = stepIndex > 0 ? story.steps[stepIndex - 1] : undefined;
                        const actionsToDisplay = getStepDelta(step, previousStep);

                        return actionsToDisplay.length > 0 ? (
                          actionsToDisplay.map((action, actionIndex) => (
                            <Tree.Node key={actionIndex}>
                              <Tree.NodeLabel>
                                {getActionIcon(action)} &nbsp;{getActionDescription(action)}
                              </Tree.NodeLabel>
                            </Tree.Node>
                          ))
                        ) : stepIndex === 0 ? (
                          <Tree.Node>
                            <Tree.NodeLabel
                              style={{ fontStyle: 'italic', color: 'var(--base-fg-dim)' }}
                            >
                              No state recorded yet
                            </Tree.NodeLabel>
                          </Tree.Node>
                        ) : (
                          <Tree.Node>
                            <Tree.NodeLabel
                              style={{ fontStyle: 'italic', color: 'var(--base-fg-dim)' }}
                            >
                              No changes from previous step
                            </Tree.NodeLabel>
                          </Tree.Node>
                        );
                      })()}
                    </Tree.Children>
                  </Tree.Node>
                ))}
              </Tree.Children>
            </Tree.Node>
          ))}
        </Tree.Root>
      )}

      <Dialog
        title="New Step"
        open={showNewStepDialog}
        onClose={() => {
          setShowNewStepDialog(false);
          setSelectedStoryIdForNewStep(undefined);
        }}
        buttons={[
          {
            type: 'cancel',
            label: 'Cancel',
            onClick: () => {
              setShowNewStepDialog(false);
              setSelectedStoryIdForNewStep(undefined);
            }
          },
          { type: 'default', label: 'Add', onClick: handleAddStep }
        ]}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label>Title</label>
            <TextInput value={newStepTitle} onChange={v => setNewStepTitle(v ?? '')} />
          </div>
          <div>
            <label>Description</label>
            <TextArea
              rows={5}
              value={newStepDescription}
              onChange={v => setNewStepDescription(v ?? '')}
            />
          </div>
        </div>
      </Dialog>
    </ToolWindowPanel>
  );
};
