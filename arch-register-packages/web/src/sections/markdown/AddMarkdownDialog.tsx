import { useState, useRef, useEffect } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { ApiError } from '../../lib/api';
import styles from '../../dialogs/AddEntityDialog.module.css';
import type { ProjectFile } from '@arch-register/api-types/projectContract';

type AddMarkdownDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (file: ProjectFile) => void;
  onCreate: (name: string) => Promise<ProjectFile>;
  isPending: boolean;
};

export const AddMarkdownDialog = ({
  open,
  onClose,
  onCreated,
  onCreate,
  isPending
}: AddMarkdownDialogProps) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setError('');
      setTimeout(() => nameRef.current?.focus(), 0);
    }
  }, [open]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required');
      return;
    }
    setError('');
    try {
      const file = await onCreate(trimmed);
      onCreated(file);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong');
      }
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New markdown document"
      buttons={[
        { label: 'Cancel', onClick: onClose, type: 'cancel' },
        { label: 'Create', onClick: handleSubmit, type: 'default', disabled: isPending }
      ]}
    >
      <div className={styles.content}>
        <FormElement label="Name" error={error}>
          <TextInput
            ref={nameRef}
            value={name}
            onChange={v => setName(v ?? '')}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="e.g. Architecture overview"
          />
        </FormElement>
      </div>
    </Dialog>
  );
};
