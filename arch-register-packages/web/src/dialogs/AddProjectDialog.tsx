import { useState, useRef, useEffect, useMemo } from 'react';
import { Dialog } from '../components/Dialog';
import { createProject, ApiError } from '../api';
import type { Project, WorkspaceOwnerOption } from '../api';
import { usePermissions } from '../auth/PermissionContext';
import styles from './AddWorkspaceDialog.module.css';

const PROJECT_STATUSES = [
  { value: 'pinned', label: 'Pinned' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
] as const;

type AddProjectDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
  workspaceId: string;
  ownerOptions: WorkspaceOwnerOption[];
};

export const AddProjectDialog = ({ open, onClose, onCreated, workspaceId, ownerOptions }: AddProjectDialogProps) => {
  const { canCreateProject } = usePermissions();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [owner, setOwner] = useState('');
  const [status, setStatus] = useState<'pinned' | 'active' | 'archived'>('active');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const creatableOwnerOptions = useMemo(
    () => ownerOptions.filter(option => canCreateProject(workspaceId, option.id)),
    [canCreateProject, ownerOptions, workspaceId]
  );
  const canCreateWithoutOwner = canCreateProject(workspaceId, null);

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setOwner(canCreateWithoutOwner ? '' : (creatableOwnerOptions[0]?.id ?? ''));
      setStatus('active');
      setError('');
      setTimeout(() => nameRef.current?.focus(), 0);
    }
  }, [canCreateWithoutOwner, creatableOwnerOptions, open]);

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
      const project = await createProject(workspaceId, {
        name: trimmed,
        description: description.trim(),
        owner: owner || null,
        status,
      });
      onCreated(project);
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
    <Dialog open={open} onClose={onClose} title="New project">
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label>Name</label>
          <input
            ref={nameRef}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Checkout Modernization"
          />
        </div>
        <div className={styles.field}>
          <label>Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Optional — what is this project about?"
          />
        </div>
        <div className={styles.field}>
          <label>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value as 'pinned' | 'active' | 'archived')}>
            {PROJECT_STATUSES.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label>Owner</label>
          <select value={owner} onChange={e => setOwner(e.target.value)}>
            {canCreateWithoutOwner && <option value="">No owner</option>}
            {creatableOwnerOptions.map(option => (
              <option key={option.id} value={option.id}>
                {option.id}
              </option>
            ))}
          </select>
        </div>
        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.actions}>
          <button type="button" className={styles.btnCancel} onClick={onClose}>Cancel</button>
          <button type="submit" className={styles.btnSubmit} disabled={submitting}>
            {submitting ? 'Creating...' : 'Create project'}
          </button>
        </div>
      </form>
    </Dialog>
  );
};
