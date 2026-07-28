import { useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';

type Props = {
  open: boolean;
  title: string;
  confirmLabel: string;
  initialName?: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
};

export const DashboardNameDialog = ({
  open,
  title,
  confirmLabel,
  initialName = '',
  onConfirm,
  onCancel
}: Props) => {
  const [name, setName] = useState(initialName);

  const confirm = () => {
    const value = name.trim();
    if (!value) return;
    onConfirm(value);
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onCancel },
        { label: confirmLabel, type: 'default', onClick: confirm, disabled: !name.trim() }
      ]}
    >
      <FormElement label="Name" required>
        <TextInput
          value={name}
          onChange={value => setName(value ?? '')}
          placeholder="e.g. Security posture"
          autoFocus
        />
      </FormElement>
    </Dialog>
  );
};
