import { useState, useRef, useEffect } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { Dialog } from '../components/Dialog';
import { ApiError } from '../api';
import { useCreateFolder } from '../hooks/useProjectFiles';
import styles from './AddWorkspaceDialog.module.css';

type AddFolderDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  workspaceId: string;
  projectId: string;
  parentFolder?: string;
};

export const AddFolderDialog = ({ open, onClose, onCreated, workspaceId, projectId, parentFolder }: AddFolderDialogProps) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const createFolderMutation = useCreateFolder(workspaceId, projectId);

  useEffect(() => {
    if (open) {
      setName('');
      setError('');
      setTimeout(() => nameRef.current?.focus(), 0);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  return (
    <Dialog open={open} onClose={onClose} title="New folder">
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label>Folder name</label>
          <input
            ref={nameRef}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Current state"
          />
        </div>
        {parentFolder && (
          <div className="dim" style={{ fontSize: 12 }}>
            Will be created inside <strong>{parentFolder}</strong>
          </div>
        )}
        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={createFolderMutation.isPending} onClick={e => { e.preventDefault(); void handleSubmit(e as unknown as React.FormEvent); }}>
            {createFolderMutation.isPending ? 'Creating...' : 'Create folder'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
