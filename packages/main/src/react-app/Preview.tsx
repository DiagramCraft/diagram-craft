import { useDiagram } from '../application';
import styles from './Preview.module.css';
import { TbWindowMaximize, TbX } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { useEffect } from 'react';
import { Canvas } from '@diagram-craft/canvas-react/Canvas';

type Props = {
  onClose: () => void;
};

export const Preview = (props: Props) => {
  const diagram = useDiagram();

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

  return (
    <div className={styles.preview}>
      <div className={styles.previewTools}>
        <Button type={'icon-only'} onClick={props.onClose}>
          <TbWindowMaximize />
        </Button>
        <Button type={'icon-only'} onClick={props.onClose}>
          <TbX />
        </Button>
      </div>

      <div className={styles.previewCanvas}>
        <Canvas diagram={diagram} width={'100%'} height={'100%'} />
      </div>
    </div>
  );
};
