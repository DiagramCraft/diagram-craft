import { Dialog } from '@diagram-craft/app-components/Dialog';
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
    <Dialog open={props.open} title={props.title} buttons={[]} onClose={props.onCancel ?? (() => {})}>
      <div
        style={{
          width: 'min(100%, calc(5 * 12rem + 4 * 0.75rem))',
          minWidth: '20rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))',
          gap: '0.75rem'
        }}
      >
        {props.actions.map(action => (
          <button
            key={action.id}
            onClick={() => props.onOk?.(action)}
            type={'button'}
            style={{
              width: '100%',
              aspectRatio: '3 / 2',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              padding: '0.75rem',
              borderRadius: 'var(--cmp-radius)',
              border: '1px solid var(--cmp-border)',
              backgroundColor: 'var(--cmp-bg)',
              color: 'var(--cmp-fg)',
              fontSize: '22px',
              lineHeight: 1.2,
              cursor: 'pointer'
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </Dialog>
  );
};
