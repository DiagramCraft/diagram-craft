import { Button, Dialog } from '@diagram-craft/app-components/Dialog';

export const MessageDialog = (props: Props) => {
  const buttons: Button[] = [
    {
      label: props.okLabel ?? 'Ok',
      type: props.okType ?? 'default',
      onClick: () => props.onOk?.()
    }
  ];

  if (props.cancelLabel !== undefined) {
    buttons.push({
      label: props.cancelLabel ?? 'Cancel',
      type: 'cancel',
      onClick: () => props.onCancel?.()
    });
  }
  return (
    <Dialog
      open={props.open}
      onClose={props.onCancel ?? (() => {})}
      title={props.title ?? 'Alert'}
      buttons={buttons}
    >
      {props.message}
    </Dialog>
  );
};

type Props = {
  open: boolean;
  title?: string;
  message?: string;
  okLabel?: string;
  okType?: 'default' | 'secondary' | 'danger';
  cancelLabel?: string;
  onOk: () => void;
  onCancel?: () => void;
};
