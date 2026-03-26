import { Dialog } from '@diagram-craft/app-components/Dialog';
import type { ResolvedNodeAction } from '@diagram-craft/model/nodeActions';
import styles from './NodeActionChooserDialog.module.css';

type Props = {
  open: boolean;
  title: string;
  actions: ResolvedNodeAction[];
  onOk?: (action: ResolvedNodeAction) => void;
  onCancel?: () => void;
};

export const NodeActionChooserDialog = (props: Props) => {
  return (
    <Dialog open={props.open} title={props.title} buttons={[]} onClose={props.onCancel ?? (() => {})}>
      <div className={styles.cGrid}>
        {props.actions.map(action => (
          <button
            key={action.id}
            onClick={() => props.onOk?.(action)}
            type={'button'}
            className={styles.cActionButton}
          >
            {action.label}
          </button>
        ))}
      </div>
    </Dialog>
  );
};
