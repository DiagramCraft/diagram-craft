import { useState, useRef, useEffect } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { ApiError } from '../lib/http';
import styles from '../dialogs/AddEntityDialog.module.css';
import { useAutoFocus } from '../hooks/useAutoFocus';

type ContentFolderDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  onSubmit: (path: string) => Promise<unknown>;
  isPending: boolean;
  parentFolder?: string;
  placeholder?: string;
};

export const ContentFolderDialog = ({
  open,
  onClose,
  onCreated,
  onSubmit,
  isPending,
  parentFolder,
  placeholder = 'e.g. Current state'
}: ContentFolderDialogProps) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  useAutoFocus(nameRef, { enabled: open });

  useEffect(() => {
    if (open) {
      setName('');
      setError('');
    }
  }, [open]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required');
      return;
    }
    if (trimmed.includes('/')) {
      setError('Folder name cannot contain /');
      return;
    }
    setError('');
    try {
      const path = parentFolder ? `${parentFolder}/${trimmed}` : trimmed;
      await onSubmit(path);
      onCreated();
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
      title="New folder"
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        {
          label: isPending ? 'Creating...' : 'Create folder',
          type: 'default',
          disabled: isPending,
          onClick: () => {
            void handleSubmit();
          }
        }
      ]}
    >
      <form
        className={styles.form}
        onSubmit={e => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <button type="submit" hidden />
        <FormElement label="Folder name" required>
          <TextInput
            ref={nameRef}
            value={name}
            onChange={value => setName(value ?? '')}
            placeholder={placeholder}
            style={{ width: '100%' }}
          />
        </FormElement>
        {parentFolder && (
          <div className="dim" style={{ fontSize: 12 }}>
            Will be created inside <strong>{parentFolder}</strong>
          </div>
        )}
        {error && <div className={styles.error}>{error}</div>}
      </form>
    </Dialog>
  );
};
