import { useState, useRef, useEffect } from 'react';
import { Dialog } from './Dialog';
import { createDiagramFile, ApiError } from '../api';
import type { FileEntry } from '../api';
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
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

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
    setSubmitting(true);
    setError('');
    try {
      const file = await createDiagramFile(workspaceId, projectId, trimmed, folder);
      onCreated(file);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong');
      }
    } finally {
      setSubmitting(false);
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
          <button type="submit" className={styles.btnSubmit} disabled={submitting}>
            {submitting ? 'Creating...' : 'Create diagram'}
          </button>
        </div>
      </form>
    </Dialog>
  );
};
