import { Button } from '@diagram-craft/app-components/Button';
import { Select } from '@diagram-craft/app-components/Select';
import { TbPlayerPlay, TbPlayerStop, TbPlayerSkipBack, TbPlayerSkipForward } from 'react-icons/tb';
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

  const handleStart = () => {
    if (!player.currentStory) {
      if (selectedStoryId) {
        player.loadStory(selectedStoryId);
      }
    }
    player.start(application.model.activeDiagram.id);
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

  return (
    <ToolWindowPanel
      mode={'headless-no-padding'}
      id={'story-player'}
      title={'Story Player'}
      style={{ padding: '0.5rem' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <Select.Root value={selectedStoryId ?? ''} onChange={value => setSelectedStoryId(value)}>
          {stories.map(story => (
            <Select.Item key={story.id} value={story.id}>
              {story.name}
            </Select.Item>
          ))}
        </Select.Root>

        {currentStory && (
          <>
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                justifyContent: 'center',
                padding: '0.5rem',
                background: 'var(--cmp-bg)',
                borderRadius: 'var(--cmp-radius)',
                border: '1px solid var(--cmp-border)'
              }}
            >
              <Button onClick={handlePrevious} type={'secondary'} disabled={currentStepIndex <= 0}>
                <TbPlayerSkipBack />
              </Button>
              <Button
                onClick={handleStart}
                type={'primary'}
                disabled={!currentStory || currentStepIndex >= 0}
              >
                <TbPlayerPlay />
              </Button>
              <Button onClick={handleStop} type="danger" disabled={currentStepIndex < 0}>
                <TbPlayerStop />
              </Button>
              <Button
                onClick={handleNext}
                type={'secondary'}
                disabled={currentStepIndex >= currentStory.steps.length - 1}
              >
                <TbPlayerSkipForward />
              </Button>
            </div>

            {currentStep && (
              <div
                style={{
                  padding: '0.25rem'
                }}
              >
                <div style={{ marginBottom: '0.5rem' }}>
                  {currentStepIndex + 1}:{' '}
                  <span style={{ fontWeight: 'bold' }}>{currentStep.title}</span>
                </div>
                <div>{currentStep.description}</div>

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
              </div>
            )}
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
