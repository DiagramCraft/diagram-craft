import { Tree } from '@diagram-craft/app-components/Tree';
import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import {
  TbPlus,
  TbTrash,
  TbList,
  TbArrowRight,
  TbEye,
  TbEyeOff,
  TbFocus2,
  TbCapture
} from 'react-icons/tb';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { useDocument, useDiagram } from '../../../application';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { useState } from 'react';
import type { Story, StoryAction, Step } from '@diagram-craft/model/documentStories';

export const StoryEditorPanel = () => {
  const redraw = useRedraw();
  const document = useDocument();
  const currentDiagram = useDiagram();
  const stories = document.stories.stories;

  const [selectedStory, setSelectedStory] = useState<Story | undefined>(
    stories.length > 0 ? stories[0] : undefined
  );
  const [showNewStepDialog, setShowNewStepDialog] = useState(false);
  const [selectedStepId, setSelectedStepId] = useState<string | undefined>();
  const [newStepTitle, setNewStepTitle] = useState('');
  const [newStepDescription, setNewStepDescription] = useState('');

  useEventListener(document.stories, 'change', () => {
    if (selectedStory) {
      setSelectedStory(document.stories.getStory(selectedStory.id));
    }
    redraw();
  });

  const handleAddStep = () => {
    if (selectedStory && newStepTitle.trim()) {
      const step = document.stories.addStep(selectedStory, newStepTitle, newStepDescription);

      if (step) {
        // Record current state
        // 1. Switch to current diagram
        document.stories.addAction(selectedStory, step, {
          type: 'switch-diagram',
          diagramId: currentDiagram.id
        });

        // 2. Record layer visibility state
        for (const layer of currentDiagram.layers.all) {
          const isVisible = currentDiagram.layers.visible.includes(layer);
          document.stories.addAction(selectedStory, step, {
            type: isVisible ? 'show-layer' : 'hide-layer',
            diagramId: currentDiagram.id,
            layerId: layer.id
          });
        }

        // 3. Record pan/zoom state
        document.stories.addAction(selectedStory, step, {
          type: 'pan-zoom',
          diagramId: currentDiagram.id,
          x: currentDiagram.viewBox.offset.x,
          y: currentDiagram.viewBox.offset.y,
          zoom: currentDiagram.viewBox.zoomLevel
        });
      }

      setNewStepTitle('');
      setNewStepDescription('');
      setShowNewStepDialog(false);
    }
  };

  const handleDeleteStep = (stepId: string) => {
    if (!selectedStory) return;

    const step = selectedStory.steps.find(s => s.id === stepId);
    if (!step) return;

    document.stories.deleteStep(selectedStory, step);
    if (selectedStepId === stepId) {
      setSelectedStepId(undefined);
    }
  };

  const handleReRecordStep = (stepId: string) => {
    if (!selectedStory) return;

    // Remove all existing actions
    const step = selectedStory.steps.find(s => s.id === stepId);
    if (!step) return;

    for (let i = step.actions.length - 1; i >= 0; i--) {
      document.stories.removeAction(selectedStory, step, i);
    }

    // Record current state
    // 1. Switch to current diagram
    document.stories.addAction(selectedStory, step, {
      type: 'switch-diagram',
      diagramId: currentDiagram.id
    });

    // 2. Record layer visibility state
    for (const layer of currentDiagram.layers.all) {
      const isVisible = currentDiagram.layers.visible.includes(layer);
      document.stories.addAction(selectedStory, step, {
        type: isVisible ? 'show-layer' : 'hide-layer',
        diagramId: currentDiagram.id,
        layerId: layer.id
      });
    }

    // 3. Record pan/zoom state
    document.stories.addAction(selectedStory, step, {
      type: 'pan-zoom',
      diagramId: currentDiagram.id,
      x: currentDiagram.viewBox.offset.x,
      y: currentDiagram.viewBox.offset.y,
      zoom: currentDiagram.viewBox.zoomLevel
    });
  };

  const getActionDescription = (action: StoryAction): string => {
    const diagram = document.byId(action.diagramId);
    const diagramName = diagram?.name ?? 'Unknown';

    switch (action.type) {
      case 'switch-diagram':
        return `Switch to diagram: ${diagramName}`;
      case 'hide-layer': {
        const layer = diagram?.layers.byId(action.layerId);
        return `Hide layer: ${layer?.name ?? 'Unknown'} (${diagramName})`;
      }
      case 'show-layer': {
        const layer = diagram?.layers.byId(action.layerId);
        return `Show layer: ${layer?.name ?? 'Unknown'} (${diagramName})`;
      }
      case 'pan-zoom':
        return `Pan/Zoom: (${action.x.toFixed(0)}, ${action.y.toFixed(0)}) @ ${(action.zoom * 100).toFixed(0)}%`;
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

  const getStepDelta = (currentStep: Step, previousStep: Step | undefined): StoryAction[] => {
    // First step - show all actions
    if (!previousStep) {
      return currentStep.actions;
    }

    // Build a map of previous step's state
    const prevState = {
      diagram: previousStep.actions.find(a => a.type === 'switch-diagram')?.diagramId,
      layers: new Map<string, boolean>(), // layerId -> isVisible
      panZoom: previousStep.actions.find(a => a.type === 'pan-zoom') as Extract<StoryAction, { type: 'pan-zoom' }> | undefined
    };

    // Record layer visibility from previous step
    for (const action of previousStep.actions) {
      if (action.type === 'show-layer') {
        prevState.layers.set(`${action.diagramId}:${action.layerId}`, true);
      } else if (action.type === 'hide-layer') {
        prevState.layers.set(`${action.diagramId}:${action.layerId}`, false);
      }
    }

    // Find changes in current step
    const delta: StoryAction[] = [];

    for (const action of currentStep.actions) {
      if (action.type === 'switch-diagram') {
        // Only show if diagram changed
        if (action.diagramId !== prevState.diagram) {
          delta.push(action);
        }
      } else if (action.type === 'show-layer' || action.type === 'hide-layer') {
        // Only show if layer visibility changed
        const key = `${action.diagramId}:${action.layerId}`;
        const prevVisibility = prevState.layers.get(key);
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

  return (
    <ToolWindowPanel
      mode={'headless-no-padding'}
      id={'story-editor'}
      title={'Story Editor'}
      style={{ padding: '0.25rem 0' }}
    >
      <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--gray-6)' }}>
        <Select.Root value={selectedStory?.id ?? ''} onChange={value => setSelectedStory(value ? document.stories.getStory(value) : undefined)}>
          {stories.map(story => (
            <Select.Item key={story.id} value={story.id}>
              {story.name}
            </Select.Item>
          ))}
        </Select.Root>
      </div>

      {selectedStory && (
        <>
          <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--gray-6)' }}>
            <Button onClick={() => setShowNewStepDialog(true)} style={{ width: '100%' }}>
              <TbPlus /> Add Step
            </Button>
          </div>

          <Tree.Root className={'cmp-story-editor'}>
            {selectedStory.steps.map((step, stepIndex) => (
              <Tree.Node
                key={step.id}
                isOpen={true}
                onClick={() => setSelectedStepId(step.id)}
                className={selectedStepId === step.id ? 'cmp-layer-list__layer--selected' : ''}
              >
                <Tree.NodeLabel>
                  <TbList /> &nbsp;{stepIndex + 1}. {step.title}
                  {step.description && (
                    <div
                      style={{ fontSize: '0.8em', color: 'var(--gray-11)', marginLeft: '1.5rem' }}
                    >
                      {step.description}
                    </div>
                  )}
                </Tree.NodeLabel>
                <Tree.NodeCell className="cmp-tree__node__action">
                  <span
                    style={{ cursor: 'pointer' }}
                    onClick={e => {
                      e.stopPropagation();
                      handleReRecordStep(step.id);
                    }}
                    title="Re-record current state"
                  >
                    <TbCapture />
                  </span>
                  <span
                    style={{ cursor: 'pointer' }}
                    onClick={e => {
                      e.stopPropagation();
                      handleDeleteStep(step.id);
                    }}
                    title="Delete step"
                  >
                    <TbTrash />
                  </span>
                </Tree.NodeCell>
                <Tree.Children>
                  {(() => {
                    const previousStep = stepIndex > 0 ? selectedStory.steps[stepIndex - 1] : undefined;
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
                        <Tree.NodeLabel style={{ fontStyle: 'italic', color: 'var(--gray-11)' }}>
                          No state recorded yet
                        </Tree.NodeLabel>
                      </Tree.Node>
                    ) : (
                      <Tree.Node>
                        <Tree.NodeLabel style={{ fontStyle: 'italic', color: 'var(--gray-11)' }}>
                          No changes from previous step
                        </Tree.NodeLabel>
                      </Tree.Node>
                    );
                  })()}
                </Tree.Children>
              </Tree.Node>
            ))}
            {selectedStory.steps.length === 0 && (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--gray-11)' }}>
                No steps yet. Add a step to get started.
              </div>
            )}
          </Tree.Root>
        </>
      )}

      {!selectedStory && (
        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--gray-11)' }}>
          Select a story to edit
        </div>
      )}

      <Dialog
        title="New Step"
        open={showNewStepDialog}
        onClose={() => setShowNewStepDialog(false)}
        buttons={[
          { type: 'cancel', label: 'Cancel', onClick: () => setShowNewStepDialog(false) },
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
            <TextInput value={newStepDescription} onChange={v => setNewStepDescription(v ?? '')} />
          </div>
        </div>
      </Dialog>
    </ToolWindowPanel>
  );
};
