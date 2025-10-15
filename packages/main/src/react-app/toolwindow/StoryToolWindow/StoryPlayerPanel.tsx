import { Button } from '@diagram-craft/app-components/Button';
import { Select } from '@diagram-craft/app-components/Select';
import {
  TbPlayerPlay,
  TbPlayerPause,
  TbPlayerStop,
  TbPlayerSkipBack,
  TbPlayerSkipForward
} from 'react-icons/tb';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { useDocument, useApplication } from '../../../application';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { useState, useEffect, useMemo } from 'react';
import { StoryPlayer } from '@diagram-craft/model/storyPlayer';

export const StoryPlayerPanel = () => {
  const redraw = useRedraw();
  const document = useDocument();
  const application = useApplication();
  const stories = document.stories.stories;

  const player = useMemo(() => new StoryPlayer(document), [document]);

  const [selectedStoryId, setSelectedStoryId] = useState<string | undefined>(
    stories.length > 0 ? stories[0]?.id : undefined
  );

  useEventListener(document.stories, 'change', redraw);
  useEventListener(player, 'stateChange', ({ story }) => {
    if (story) {
      const currentStep = story.steps[player.currentStepIndex];
      if (currentStep) {
        for (const action of currentStep.actions) {
          if (action.type === 'switch-diagram') {
            const diagram = document.byId(action.diagramId);
            if (diagram) {
              application.model.activeDiagram = diagram;
            }
          }
        }
      }
    } else if (player.currentStepIndex === -1 && player.savedDiagramId) {
      // Restore the original diagram when stopped
      const diagram = document.byId(player.savedDiagramId);
      if (diagram) {
        application.model.activeDiagram = diagram;
      }
    }
    redraw();
  });

  useEffect(() => {
    if (selectedStoryId) {
      player.loadStory(selectedStoryId);
    }
  }, [selectedStoryId, player]);

  const handlePlay = () => {
    if (!player.currentStory) {
      if (selectedStoryId) {
        player.loadStory(selectedStoryId);
      }
    }
    player.play(application.model.activeDiagram.id);
  };

  const handlePause = () => {
    player.pause();
  };

  const handleStop = () => {
    player.stop();
  };

  const handleNext = () => {
    player.next();
  };

  const handlePrevious = () => {
    player.previous();
  };

  const currentStory = player.currentStory;
  const currentStep = player.currentStep;
  const currentStepIndex = player.currentStepIndex;
  const isPlaying = player.isPlaying;

  return (
    <ToolWindowPanel
      mode={'headless-no-padding'}
      id={'story-player'}
      title={'Story Player'}
      style={{ padding: '0.5rem' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Select Story</label>
          <Select.Root value={selectedStoryId ?? ''} onChange={value => setSelectedStoryId(value)}>
            {stories.map(story => (
              <Select.Item key={story.id} value={story.id}>
                {story.name}
              </Select.Item>
            ))}
          </Select.Root>
        </div>

        {currentStory && (
          <>
            <div
              style={{
                padding: '1rem',
                background: 'var(--gray-3)',
                borderRadius: '0.25rem',
                border: '1px solid var(--gray-6)'
              }}
            >
              <div style={{ fontSize: '0.9em', color: 'var(--gray-11)', marginBottom: '0.5rem' }}>
                {currentStory.description}
              </div>
              <div style={{ fontSize: '0.8em', color: 'var(--gray-10)' }}>
                {currentStory.steps.length} step{currentStory.steps.length !== 1 ? 's' : ''}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                justifyContent: 'center',
                padding: '0.5rem',
                background: 'var(--gray-2)',
                borderRadius: '0.25rem'
              }}
            >
              <Button onClick={handlePrevious} disabled={currentStepIndex <= 0}>
                <TbPlayerSkipBack />
              </Button>
              {!isPlaying ? (
                <Button onClick={handlePlay} disabled={!currentStory}>
                  <TbPlayerPlay />
                </Button>
              ) : (
                <Button onClick={handlePause}>
                  <TbPlayerPause />
                </Button>
              )}
              <Button onClick={handleStop} disabled={currentStepIndex < 0}>
                <TbPlayerStop />
              </Button>
              <Button
                onClick={handleNext}
                disabled={currentStepIndex >= currentStory.steps.length - 1}
              >
                <TbPlayerSkipForward />
              </Button>
            </div>

            {currentStep && (
              <div
                style={{
                  padding: '1rem',
                  background: 'var(--blue-3)',
                  borderRadius: '0.25rem',
                  border: '1px solid var(--blue-6)'
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  Step {currentStepIndex + 1}: {currentStep.title}
                </div>
                <div style={{ fontSize: '0.9em', color: 'var(--gray-12)' }}>
                  {currentStep.description}
                </div>
                {currentStep.actions.length > 0 && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.8em', color: 'var(--gray-11)' }}>
                    {currentStep.actions.length} action{currentStep.actions.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            )}

            {currentStepIndex < 0 && (
              <div style={{ textAlign: 'center', color: 'var(--gray-11)', padding: '1rem' }}>
                Press play to start the story
              </div>
            )}

            <div style={{ marginTop: '1rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.8em',
                  color: 'var(--gray-11)',
                  marginBottom: '0.5rem'
                }}
              >
                <span>Progress</span>
                <span>
                  {Math.max(0, currentStepIndex + 1)} / {currentStory.steps.length}
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: '0.5rem',
                  background: 'var(--gray-4)',
                  borderRadius: '0.25rem',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    width: `${((currentStepIndex + 1) / currentStory.steps.length) * 100}%`,
                    height: '100%',
                    background: 'var(--blue-9)',
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>
            </div>
          </>
        )}

        {!currentStory && (
          <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--gray-11)' }}>
            Select a story to play
          </div>
        )}
      </div>
    </ToolWindowPanel>
  );
};
