import { useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';

export const CreateCollectionDialog = ({
  open,
  onCreate,
  onCancel
}: {
  open: boolean;
  onCreate: (name: string) => void;
  onCancel: () => void;
}) => {
  const [name, setName] = useState('');
  const create = () => {
    const value = name.trim();
    if (!value) return;
    onCreate(value);
    setName('');
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title="New collection"
      buttons={[
        { label: 'Cancel', type: 'secondary', onClick: onCancel },
        { label: 'Create collection', type: 'default', onClick: create, disabled: !name.trim() }
      ]}
    >
      <FormElement label="Name" required>
        <TextInput
          value={name}
          onChange={value => setName(value ?? '')}
          placeholder="e.g. Q3 migration"
          autoFocus
        />
      </FormElement>
    </Dialog>
  );
};
