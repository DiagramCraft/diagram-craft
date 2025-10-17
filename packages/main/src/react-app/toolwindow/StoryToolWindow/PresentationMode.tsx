import { useApplication, useDiagram, useDocument } from '../../../application';
import styles from './PresentationMode.module.css';
import {
  TbPlayerSkipBack,
  TbPlayerSkipForward,
  TbWindowMaximize,
  TbWindowMinimize,
  TbX
} from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { useEffect, useState } from 'react';
import { Canvas } from '@diagram-craft/canvas-react/Canvas';
import {
  InteractiveCanvasComponent,
  InteractiveCanvasProps
} from '@diagram-craft/canvas/canvas/InteractiveCanvasComponent';
import { Viewbox } from '@diagram-craft/model/viewBox';
import { StoryPlayer } from '@diagram-craft/model/storyPlayer';
import { Story } from '@diagram-craft/model/documentStories';

type Props = {
  onClose: () => void;
  story: Story;
};

export const PresentationMode = (props: Props) => {
  const application = useApplication();
  const diagram = useDiagram();
  const doc = useDocument();
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [viewbox, setViewbox] = useState<Viewbox | undefined>();
  const [player] = useState(() => new StoryPlayer(doc, d => (application.model.activeDiagram = d)));
  const [playerState, setPlayerState] = useState({
    currentStepIndex: -1,
    currentStep: player.currentStep
  });
  const [_updateCounter, setUpdateCounter] = useState(0);

  useEffect(() => {
    const vb = diagram.viewBox.duplicate();
    setViewbox(vb);

    // Listen to viewbox changes to trigger re-renders
    const listener = () => setUpdateCounter(c => c + 1);
    vb.on('viewbox', listener);

    return () => {
      vb.off('viewbox', listener);
    };
  }, [diagram]);

  useEffect(() => {
    const cb = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevious();
      }
    };
    document.addEventListener('keydown', cb);
    return () => {
      document.removeEventListener('keydown', cb);
    };
  }, [playerState.currentStepIndex]);

  useEffect(() => {
    player.loadStory(props.story);
    const listener = () => {
      setPlayerState({
        currentStepIndex: player.currentStepIndex,
        currentStep: player.currentStep
      });

      // Sync viewbox with diagram's viewbox after each step
      if (viewbox) {
        const diagramVb = diagram.viewBox;
        viewbox.pan(diagramVb.offset);
        const zoomFactor = diagramVb.zoomLevel / viewbox.zoomLevel;
        viewbox.zoom(zoomFactor);
      }
    };
    player.on('stateChange', listener);

    // Auto-start at step 1
    player.start(application.model.activeDiagram);

    return () => {
      player.off('stateChange', listener);
      player.stop();
    };
  }, [player, props.story, application, viewbox, diagram]);

  const handleNext = () => {
    if (playerState.currentStepIndex < props.story.steps.length - 1) {
      player.next();
    }
  };

  const handlePrevious = () => {
    if (playerState.currentStepIndex > 0) {
      player.previous();
    }
  };

  const handleClose = async () => {
    try {
      await document.exitFullscreen();
    } catch (_e) {
      // Ignore
    }
    props.onClose();
  };

  if (!viewbox) return null;

  const currentStep = playerState.currentStep;
  const currentStepIndex = playerState.currentStepIndex;

  return (
    <div className={`${styles.presentation}`} id={'presentation'}>
      <div className={styles.presentationTools}>
        {!isFullScreen && (
          <Button
            type={'icon-only'}
            onClick={() => {
              document.getElementById('presentation')?.requestFullscreen();
              setIsFullScreen(true);
            }}
          >
            <TbWindowMaximize />
          </Button>
        )}
        {isFullScreen && (
          <Button
            type={'icon-only'}
            onClick={async () => {
              try {
                await document.exitFullscreen();
                setIsFullScreen(false);
              } catch (_e) {
                // Ignore
              }
            }}
          >
            <TbWindowMinimize />
          </Button>
        )}
        <Button type={'icon-only'} onClick={handleClose}>
          <TbX />
        </Button>
      </div>

      {currentStep && (
        <div className={styles.presentationHeader}>
          <div className={styles.presentationHeaderTitle}>{currentStep.title}</div>
          <div className={styles.presentationHeaderDescription}>{currentStep.description}</div>
        </div>
      )}

      <div className={`${styles.presentationCanvas}  light-theme`}>
        <Canvas<InteractiveCanvasComponent, InteractiveCanvasProps>
          id={`presentation-canvas-${diagram.id}`}
          context={application}
          diagram={diagram}
          viewbox={viewbox}
          width={'100%'}
          height={'100%'}
          onMouseDown={(id: string) => {
            application.actions['SELECTION_EXECUTE_ACTION']?.execute({ id });
          }}
        />
      </div>

      <div className={styles.presentationControls}>
        <div className={styles.presentationControlsInner}>
          <Button onClick={handlePrevious} type={'secondary'} disabled={currentStepIndex <= 0}>
            <TbPlayerSkipBack />
          </Button>
          <Button
            onClick={handleNext}
            type={'primary'}
            disabled={currentStepIndex >= props.story.steps.length - 1}
          >
            <TbPlayerSkipForward />
          </Button>
          <div className={styles.presentationControlsProgress}>
            {currentStepIndex >= 0 ? currentStepIndex + 1 : 0} / {props.story.steps.length}
          </div>
        </div>
      </div>
    </div>
  );
};
