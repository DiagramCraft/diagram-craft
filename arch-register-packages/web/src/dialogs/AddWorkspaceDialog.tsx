import { useState, useRef, useEffect } from 'react';
import { Dialog } from '../components/Dialog';
import { apiFetch, ApiError } from '../api';
import styles from './AddWorkspaceDialog.module.css';

type ApiWorkspace = {
  id: string;
  name: string;
  url_slug: string;
  description: string;
  created_at: string;
  updated_at: string;
};

type AddWorkspaceDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (ws: ApiWorkspace) => void;
};

export const AddWorkspaceDialog = ({ open, onClose, onCreated }: AddWorkspaceDialogProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
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
    setSubmitting(true);
    setError('');
    try {
      const ws = await apiFetch<ApiWorkspace>('/api/workspaces', {
        method: 'POST',
        body: JSON.stringify({ name: trimmed, description: description.trim() }),
      });
      onCreated(ws);
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
    <Dialog open={open} onClose={onClose} title="New workspace">
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label>Name</label>
          <input
            ref={nameRef}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Acme Platform"
          />
        </div>
        <div className={styles.field}>
          <label>Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Optional — what is this workspace for?"
          />
        </div>
        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.actions}>
          <button type="button" className={styles.btnCancel} onClick={onClose}>Cancel</button>
          <button type="submit" className={styles.btnSubmit} disabled={submitting}>
            {submitting ? 'Creating...' : 'Create workspace'}
          </button>
        </div>
      </form>
    </Dialog>
  );
};
