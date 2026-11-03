import { useEffect, useRef, useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { useAutoFocus } from '../hooks/useAutoFocus';

export const RenameDialog = ({
  open,
  currentName,
  entityType,
  onRename,
  onCancel
}: {
  open: boolean;
  currentName: string;
  entityType: string;
  onRename: (newName: string) => void;
  onCancel: () => void;
}) => {
  const [name, setName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);
  useAutoFocus(inputRef, {
    enabled: open,
    onFocused: element => element.select()
  });

  useEffect(() => {
    if (!open) return;
    setName(currentName);
  }, [open, currentName]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (trimmed) onRename(trimmed);
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={`Rename ${entityType}`}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onCancel },
        { label: 'Rename', type: 'default', disabled: !name.trim(), onClick: handleSubmit }
      ]}
    >
      <form
        onSubmit={event => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <button type="submit" hidden />
        <FormElement label="Name">
          <TextInput ref={inputRef} value={name} onChange={value => setName(value ?? '')} />
        </FormElement>
      </form>
    </Dialog>
  );
};
