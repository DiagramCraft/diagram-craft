import { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { Dialog } from '../components/Dialog';
import { createProject, ApiError } from '../api';
import type { Project, WorkspaceTeam } from '../api';
import { usePermissions } from '../auth/PermissionContext';
import { ColorPicker } from '../components/ColorPicker';
import styles from './AddEntityDialog.module.css';

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
  teams: WorkspaceTeam[];
};

export const AddProjectDialog = ({ open, onClose, onCreated, workspaceId, teams }: AddProjectDialogProps) => {
  const { canCreateProject } = usePermissions();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [owner, setOwner] = useState('');
  const [status, setStatus] = useState<'pinned' | 'active' | 'archived'>('active');
  const [color, setColor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const creatableTeams = useMemo(
    () => teams.filter(team => canCreateProject(workspaceId, team.id)),
    [canCreateProject, teams, workspaceId]
  );
  const canCreateWithoutOwner = canCreateProject(workspaceId, null);

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setOwner(canCreateWithoutOwner ? '' : (creatableTeams[0]?.id ?? ''));
      setStatus('active');
      setColor(null);
      setError('');
      setTimeout(() => nameRef.current?.focus(), 0);
    }
  }, [canCreateWithoutOwner, creatableTeams, open]);

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
        color,
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
            {creatableTeams.map(team => (
              <option key={team.id} value={team.id}>
                {team.id}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label>Color</label>
          <ColorPicker value={color} onChange={setColor} size="small" />
        </div>
        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={submitting} onClick={e => { e.preventDefault(); void handleSubmit(e as unknown as React.FormEvent); }}>
            {submitting ? 'Creating...' : 'Create project'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
