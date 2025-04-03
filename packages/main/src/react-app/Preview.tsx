import { useApplication, useDiagram } from '../application';
import styles from './Preview.module.css';
import { TbWindowMaximize, TbWindowMinimize, TbX } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { useEffect, useState } from 'react';
import { Canvas } from '@diagram-craft/canvas-react/Canvas';
import {
  InteractiveCanvasProps,
  InteractiveCanvasComponent
} from '@diagram-craft/canvas/canvas/InteractiveCanvasComponent';
import { Viewbox } from '@diagram-craft/model/viewBox';

type Props = {
  onClose: () => void;
};

export const Preview = (props: Props) => {
  const application = useApplication();
  const diagram = useDiagram();
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [viewbox, setViewbox] = useState<Viewbox | undefined>();

  useEffect(() => {
    setViewbox(diagram.viewBox.duplicate());
  }, [diagram]);

  useEffect(() => {
    const cb = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        props.onClose();
      }
    };
    document.addEventListener('keydown', cb);
    return () => {
      document.removeEventListener('keydown', cb);
    };
  }, []);

  if (!viewbox) return null;

  return (
    <div className={styles.preview} id={'preview'}>
      <div className={styles.previewTools}>
        {!isFullScreen && (
          <Button
            type={'icon-only'}
            onClick={() => {
              document.getElementById('preview')?.requestFullscreen();
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
              } catch (e) {
                // Ignore
              }
            }}
          >
            <TbWindowMinimize />
          </Button>
        )}
        <Button
          type={'icon-only'}
          onClick={async () => {
            try {
              await document.exitFullscreen();
            } catch (e) {
              // Ignore
            }
            props.onClose();
          }}
        >
          <TbX />
        </Button>
      </div>

      <div className={styles.previewCanvas}>
        <Canvas<InteractiveCanvasComponent, InteractiveCanvasProps>
          id={`preview-canvas-${diagram.id}`}
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
    </div>
  );
};
