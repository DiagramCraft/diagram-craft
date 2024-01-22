import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { ReactNode } from 'react';

const DialogButton = (props: Button) => {
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

export const Dialog = (props: Props) => {
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
            <AlertDialog.Description asChild>
              <div className="cmp-dialog__description">{props.children}</div>
            </AlertDialog.Description>

            <div style={{ display: 'flex', gap: 25, justifyContent: 'flex-end' }}>
              {props.buttons.map(btn => (
                <DialogButton key={btn.label} {...btn} />
              ))}
            </div>
          </AlertDialog.Content>
        </div>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode | string;
  buttons: Button[];
};

export type Button = {
  label: string;
  type: 'default' | 'secondary' | 'cancel' | 'danger';
  onClick: () => void;
};
