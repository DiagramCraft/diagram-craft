import { Button, Dialog } from './Dialog.tsx';

export const SimpleDialog = (props: Props) => {
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
