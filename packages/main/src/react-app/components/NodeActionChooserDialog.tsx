import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Button } from '@diagram-craft/app-components/Button';
import type { ResolvedNodeAction } from '@diagram-craft/model/nodeActions';

type Props = {
  open: boolean;
  title: string;
  actions: ResolvedNodeAction[];
  onOk?: (action: ResolvedNodeAction) => void;
  onCancel?: () => void;
};

export const NodeActionChooserDialog = (props: Props) => {
  return (
    <Dialog
      open={props.open}
      title={props.title}
      buttons={[
        {
          type: 'cancel',
          onClick: () => props.onCancel?.(),
          label: 'Cancel'
        }
      ]}
      onClose={props.onCancel ?? (() => {})}
    >
      <div className={'util-vstack'} style={{ minWidth: '20rem', gap: '0.5rem' }}>
        {props.actions.map(action => (
          <Button
            key={action.id}
            variant={'secondary'}
            onClick={() => props.onOk?.(action)}
            style={{ justifyContent: 'flex-start' }}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </Dialog>
  );
};
