import { useState, useRef, useEffect } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { ApiError } from '../../lib/api';
import { useCreateEntityFolder } from '../../hooks/useProjects';
import styles from '../../dialogs/AddEntityDialog.module.css';

type AddEntityFolderDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  workspaceSlug: string;
  entityId: string;
  parentFolder?: string;
};

export const AddEntityFolderDialog = ({
  open,
  onClose,
  onCreated,
  workspaceSlug,
  entityId,
  parentFolder
}: AddEntityFolderDialogProps) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const createFolderMutation = useCreateEntityFolder(workspaceSlug, entityId);

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
    if (trimmed.includes('/')) {
      setError('Folder name cannot contain /');
      return;
    }
    setError('');
    try {
      const path = parentFolder ? `${parentFolder}/${trimmed}` : trimmed;
      await createFolderMutation.mutateAsync(path);
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

  const isPending = createFolderMutation.isPending;

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
        <FormElement label="Folder name">
          <TextInput
            ref={nameRef}
            value={name}
            onChange={value => setName(value ?? '')}
            placeholder="e.g. Architecture diagrams"
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
