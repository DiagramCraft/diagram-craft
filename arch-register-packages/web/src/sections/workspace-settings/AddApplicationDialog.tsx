import { useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { ColorPicker } from '../../components/ColorPicker';
import { slugifyEntityName } from '../../lib/entityEditState';

export type NewApplication = {
  key: string;
  name: string;
  description: string;
  accentColor: string | null;
};

export const AddApplicationDialog = ({
  open,
  error,
  onCancel,
  onConfirm
}: {
  open: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: (application: NewApplication) => void;
}) => {
  const [name, setName] = useState('');
  const [key, setKey] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [accentColor, setAccentColor] = useState<string | null>(null);

  const effectiveKey = key ?? slugifyEntityName(name);
  const valid = name.trim() !== '' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(effectiveKey);

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title="Add application"
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onCancel },
        {
          label: 'Add application',
          type: 'default',
          disabled: !valid,
          onClick: () =>
            onConfirm({
              key: effectiveKey,
              name: name.trim(),
              description: description.trim(),
              accentColor
            })
        }
      ]}
    >
      {error && <div role="alert">{error}</div>}
      <FormElement label="Name" required>
        <TextInput value={name} onChange={value => setName(value ?? '')} autoFocus />
      </FormElement>
      <FormElement
        label="Key"
        required
        hint="Lowercase slug used in URLs; cannot be changed later."
      >
        <TextInput value={effectiveKey} onChange={value => setKey(value ?? '')} />
      </FormElement>
      <FormElement label="Description">
        <TextInput value={description} onChange={value => setDescription(value ?? '')} />
      </FormElement>
      <FormElement label="Accent color">
        <ColorPicker value={accentColor} onChange={setAccentColor} size="small" />
      </FormElement>
    </Dialog>
  );
};
