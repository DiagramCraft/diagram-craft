import { useApplication, useDocument } from '../../../application';
import styles from './PresentationMode.module.css';
import {
  TbPlayerSkipBack,
  TbPlayerSkipForward,
  TbWindowMaximize,
  TbWindowMinimize,
  TbX
} from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { useCallback, useEffect, useState } from 'react';
import { Canvas } from '@diagram-craft/canvas-react/Canvas';
import {
  InteractiveCanvasComponent,
  InteractiveCanvasProps
} from '@diagram-craft/canvas/canvas/InteractiveCanvasComponent';
import { StoryPlayer } from '@diagram-craft/model/storyPlayer';
import { Story } from '@diagram-craft/model/documentStories';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { useRedraw } from '../../hooks/useRedraw';

type Props = {
  onClose: () => void;
  story: Story;
};

const showActive = (immediate = false) => {
  const other = document.getElementById('presentation-canvas-other-canvas')!;
  const active = document.getElementById('presentation-canvas-active-canvas')!;

  if (immediate) {
    active.style.opacity = '1';
    other.style.opacity = '0';
    return;
  }

  const now = Date.now();
  const animationDuration = 2000;

  const step = () => {
    const timestamp = Date.now();
    const sinceStart = timestamp - now;
    const progress = sinceStart / animationDuration;
    if (sinceStart >= animationDuration) {
      active.style.opacity = '1';
      other.style.opacity = '0';
    } else {
      const opacity = progress;
      active.style.opacity = opacity.toString();
      other.style.opacity = (1 - opacity).toString();
      if (progress <= 1) {
        requestAnimationFrame(step);
      }
    }
  };
  requestAnimationFrame(step);
};

const hideActive = () => {
  const other = document.getElementById('presentation-canvas-other-canvas')!;
  const active = document.getElementById('presentation-canvas-active-canvas')!;
  other.style.opacity = '1';
  active.style.opacity = '0';
};

export const PresentationMode = (props: Props) => {
  const application = useApplication();
  const doc = useDocument();
  const redraw = useRedraw();
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [_updateCounter, setUpdateCounter] = useState(0);

  const doc1 = new DiagramDocument(doc.nodeDefinitions, doc.edgeDefinitions, false, doc.root);
  const [activeDiagram1, setActiveDiagram1] = useState(doc1.diagrams[0]!);
  const [player1] = useState(() => new StoryPlayer(doc1, setActiveDiagram1));

  const doc2 = new DiagramDocument(doc.nodeDefinitions, doc.edgeDefinitions, false, doc.root);
  const [activeDiagram2, setActiveDiagram2] = useState(doc2.diagrams[0]!);
  const [player2] = useState(() => new StoryPlayer(doc2, setActiveDiagram2));

  useEffect(() => {
    player1.loadStory(props.story);
    player1.start(activeDiagram1);

    player2.loadStory(props.story);
    player2.start(activeDiagram2);

    setUpdateCounter(c => c + 1);
    showActive(true);
  }, [activeDiagram1, activeDiagram2, player1, player2, props.story]);

  const handleClose = useCallback(async () => {
    try {
      await document.exitFullscreen();
    } catch (_e) {
      // Ignore
    }
    props.onClose();
  }, [props.onClose]);

  const handleNext = useCallback(() => {
    if (player1.currentStepIndex < props.story.steps.length - 1) {
      player2.goToStep(player1.currentStepIndex);
      hideActive();
      player1.goToStep(player1.currentStepIndex + 1);
      redraw();
      setTimeout(() => showActive());
    }
  }, [player1, player2, props.story.steps.length, redraw]);

  const handlePrevious = useCallback(() => {
    if (player1.currentStepIndex > 0) {
      player2.goToStep(player1.currentStepIndex);
      hideActive();
      player1.goToStep(player1.currentStepIndex - 1);
      redraw();
      setTimeout(() => showActive());
    }
  }, [player1, player2, redraw]);

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
  }, [handleClose, handleNext, handlePrevious]);

  const currentStep = player1.currentStep;

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
          id={`presentation-canvas-other-canvas`}
          key={`presentation-canvas-other-${activeDiagram2.id}`}
          context={application}
          diagram={activeDiagram2}
          viewbox={activeDiagram2.viewBox}
          width={'100%'}
          height={'100%'}
        />
        <Canvas<InteractiveCanvasComponent, InteractiveCanvasProps>
          id={`presentation-canvas-active-canvas`}
          key={`presentation-canvas-active-${activeDiagram1.id}`}
          context={application}
          diagram={activeDiagram1}
          viewbox={activeDiagram1.viewBox}
          width={'100%'}
          height={'100%'}
          className={styles.presentationHiddenCanvas}
        />
      </div>
      <div className={styles.presentationControls}>
        <div className={styles.presentationControlsInner}>
          <Button
            onClick={handlePrevious}
            type={'secondary'}
            disabled={player1.currentStepIndex <= 0}
          >
            <TbPlayerSkipBack />
          </Button>
          <Button
            onClick={handleNext}
            type={'primary'}
            disabled={player1.currentStepIndex >= props.story.steps.length - 1}
          >
            <TbPlayerSkipForward />
          </Button>
          <div className={styles.presentationControlsProgress}>
            {player1.currentStepIndex >= 0 ? player1.currentStepIndex + 1 : 0} /{' '}
            {props.story.steps.length}
          </div>
        </div>
      </div>
    </div>
  );
};
