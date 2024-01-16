import * as AlertDialog from '@radix-ui/react-alert-dialog';

const SimpleDialogButton = (props: Button) => {
  if (props.type === 'cancel') {
    return (
      <AlertDialog.Cancel asChild>
        <button
          className="cmp-dialog__button cmp-dialog__button--secondary"
          onClick={props.onClick}
        >
          {props.label}
        </button>
      </AlertDialog.Cancel>
    );
  } else {
    return (
      <AlertDialog.Action asChild>
        <button
          className={`cmp-dialog__button cmp-dialog__button--${props.type}`}
          onClick={props.onClick}
        >
          {props.label}
        </button>
      </AlertDialog.Action>
    );
  }
};

export const SimpleDialog = (props: Props) => {
  return (
    <AlertDialog.Root
      open={props.isOpen}
      defaultOpen={props.isOpen}
      onOpenChange={open => {
        if (!open) {
          props.onClose();
        }
      }}
    >
      <AlertDialog.Portal>
        <div className={'cmp-dialog'}>
          <AlertDialog.Overlay className="cmp-dialog__overlay" />
          <AlertDialog.Content className="cmp-dialog__content">
            <AlertDialog.Title className="cmp-dialog__title">{props.title}</AlertDialog.Title>
            <AlertDialog.Description className="cmp-dialog__description">
              {props.message}
            </AlertDialog.Description>
            <div style={{ display: 'flex', gap: 25, justifyContent: 'flex-end' }}>
              {props.buttons.map(btn => (
                <SimpleDialogButton key={btn.label} {...btn} />
              ))}
            </div>
          </AlertDialog.Content>
        </div>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};

type Props = SimpleDialogState & {
  onClose: () => void;
};

SimpleDialog.INITIAL_STATE = {
  isOpen: false,
  title: '',
  message: '',
  buttons: []
};

export type SimpleDialogState = {
  isOpen: boolean;
  title: string;
  message: string;
  buttons: Button[];
};

export type Button = {
  label: string;
  type: 'default' | 'secondary' | 'cancel' | 'danger';
  onClick: () => void;
};
