import { useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';

type Props = {
  open: boolean;
  title: string;
  confirmLabel: string;
  initialName?: string;
  /** When set (even to ''), the dialog also edits a description. */
  initialDescription?: string;
  onConfirm: (name: string, description: string) => void;
  onCancel: () => void;
};

export const DashboardNameDialog = ({
  open,
  title,
  confirmLabel,
  initialName = '',
  initialDescription,
  onConfirm,
  onCancel
}: Props) => {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? '');

  const confirm = () => {
    const value = name.trim();
    if (!value) return;
    onConfirm(value, description.trim());
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
      {initialDescription !== undefined && (
        <FormElement label="Description">
          <TextInput value={description} onChange={value => setDescription(value ?? '')} />
        </FormElement>
      )}
    </Dialog>
  );
};
