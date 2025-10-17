import { Button } from '@diagram-craft/app-components/Button';
import { Select } from '@diagram-craft/app-components/Select';
import {
  TbPlayerPlay,
  TbPlayerSkipBack,
  TbPlayerSkipForward,
  TbPlayerStop,
  TbPresentation
} from 'react-icons/tb';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { useApplication, useDocument } from '../../../application';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { useEffect, useMemo, useState } from 'react';
import { StoryPlayer } from '@diagram-craft/model/storyPlayer';
import { mustExist } from '@diagram-craft/utils/assert';
import { PresentationMode } from './PresentationMode';
import { usePortal } from '@diagram-craft/app-components/PortalContext';
import { Portal } from '@radix-ui/react-portal';

export const StoryPlayerPanel = () => {
  const redraw = useRedraw();
  const document = useDocument();
  const application = useApplication();
  const stories = document.stories.stories;
  const [showPresentation, setShowPresentation] = useState(false);
  const portal = usePortal();

  const player = useMemo(
    () => new StoryPlayer(document, d => (application.model.activeDiagram = d)),
    [document, application]
  );

  const [selectedStoryId, setSelectedStoryId] = useState<string | undefined>(
    stories.length > 0 ? stories[0]?.id : undefined
  );

  useEventListener(document.stories, 'change', redraw);

  useEffect(() => {
    if (selectedStoryId) {
      player.loadStory(mustExist(document.stories.getStory(selectedStoryId)));
    }
  }, [selectedStoryId, player, document]);

  if (selectedStoryId && !player.currentStory) {
    player.loadStory(mustExist(document.stories.getStory(selectedStoryId)));
  }

  const handleStart = () => {
    if (!player.currentStory) {
      if (selectedStoryId) {
        player.loadStory(mustExist(document.stories.getStory(selectedStoryId)));
      }
    }
    player.start(application.model.activeDiagram);
  };

  const handleStop = () => player.stop();
  const handleNext = () => player.next();
  const handlePrevious = () => player.previous();

  const handlePresentationMode = () => {
    if (selectedStoryId) {
      setShowPresentation(true);
    }
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
        <div style={{ display: 'flex', gap: '0.5rem' }}>
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
                type={!currentStory || currentStepIndex >= 0 ? 'secondary' : 'primary'}
                disabled={!currentStory || currentStepIndex >= 0}
              >
                <TbPlayerPlay />
              </Button>
              <Button
                onClick={handlePresentationMode}
                type={'primary'}
                disabled={!selectedStoryId}
                title="Start Presentation Mode"
              >
                <TbPresentation />
              </Button>
              <Button
                onClick={handleStop}
                type={currentStepIndex < 0 ? 'secondary' : 'primary'}
                disabled={currentStepIndex < 0}
              >
                <TbPlayerStop />
              </Button>
              <Button
                onClick={handleNext}
                type={
                  currentStepIndex >= 0 && currentStepIndex < currentStory.steps.length - 1
                    ? 'primary'
                    : 'secondary'
                }
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
                      color: 'var(--base-fg-dim)',
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
                      background: 'var(--accent-bg)',
                      borderRadius: '0.25rem',
                      overflow: 'hidden'
                    }}
                  >
                    <div
                      style={{
                        width: `${((currentStepIndex + 1) / currentStory.steps.length) * 100}%`,
                        height: '100%',
                        background: 'var(--accent-chroma)',
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
          <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--base-fg-dim)' }}>
            Select a story to play
          </div>
        )}
      </div>

      {showPresentation && selectedStoryId && (
        <Portal container={portal}>
          <PresentationMode
            story={mustExist(document.stories.getStory(selectedStoryId))}
            onClose={() => setShowPresentation(false)}
          />
        </Portal>
      )}
    </ToolWindowPanel>
  );
};
