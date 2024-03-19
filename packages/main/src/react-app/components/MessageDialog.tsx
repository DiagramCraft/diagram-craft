import { Button, Dialog } from './Dialog.tsx';

export const MessageDialog = (props: Props) => {
  return (
    <Dialog
      isOpen={props.isOpen}
      onClose={props.onClose}
      title={props.title}
      buttons={props.buttons}
    >
      {props.message}
    </Dialog>
  );
};

type Props = MessageDialogState & {
  onClose: () => void;
};

MessageDialog.INITIAL_STATE = {
  isOpen: false,
  title: '',
  message: '',
  buttons: []
};

export type MessageDialogState = {
  isOpen: boolean;
  title: string;
  message: string;
  buttons: Button[];
};
