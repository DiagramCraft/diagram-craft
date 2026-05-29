import { useState, useRef, useEffect } from 'react';
import { Dialog } from '../components/Dialog';
import { ApiError } from '../api';
import type { FileEntry } from '../api';
import { useCreateDiagramFile } from '../hooks/useProjectFiles';
import styles from './AddWorkspaceDialog.module.css';

type AddDiagramDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (file: FileEntry) => void;
  workspaceId: string;
  projectId: string;
  folder?: string | null;
};

export const AddDiagramDialog = ({ open, onClose, onCreated, workspaceId, projectId, folder }: AddDiagramDialogProps) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const createDiagramMutation = useCreateDiagramFile(workspaceId, projectId);

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
      setError('Name cannot contain /');
      return;
    }
    setError('');
    try {
      const file = await createDiagramMutation.mutateAsync({ name: trimmed, folder });
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
    <Dialog open={open} onClose={onClose} title="New diagram">
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label>Diagram name</label>
          <input
            ref={nameRef}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. System overview"
          />
        </div>
        {folder && (
          <div className="dim" style={{ fontSize: 12 }}>
            Will be created in <strong>{folder}</strong>
          </div>
        )}
        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.actions}>
          <button type="button" className={styles.btnCancel} onClick={onClose}>Cancel</button>
          <button type="submit" className={styles.btnSubmit} disabled={createDiagramMutation.isPending}>
            {createDiagramMutation.isPending ? 'Creating...' : 'Create diagram'}
          </button>
        </div>
      </form>
    </Dialog>
  );
};
