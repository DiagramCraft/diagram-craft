import { TbTrash } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import styles from './DirtyIndicator.module.css';

export const DirtyIndicator = (props: Props) => {
  if (!props.dirty) return null;

  return (
    <div className={styles.cmpDirtyIndicator}>
      <div className={styles.cmpDirtyIndicatorText}>- Unsaved</div>
      {props.onDirtyChange && (
        <Button type={'icon-only'} onClick={() => props.onDirtyChange!()}>
          <TbTrash size={'14px'} />
        </Button>
      )}
    </div>
  );
};

type Props = {
  dirty: boolean;
  onDirtyChange?: () => void;
};
