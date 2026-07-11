import { useEffect, useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Button } from '@diagram-craft/app-components/Button';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { TbTrash } from 'react-icons/tb';
import { ColorPicker } from '../../../components/ColorPicker';
import { useUpdateProject, useDeleteProject } from '../../../hooks/useProjects';
import { ApiError } from '../../../lib/http';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import styles from './ProjectSettingsForm.module.css';

const PROJECT_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'complete', label: 'Complete' },
  { value: 'cancelled', label: 'Cancelled' }
] as const;

type Props = {
  project: ProjectDetailData;
  workspaceId: string;
  teams: WorkspaceTeam[];
  onSaved: () => void;
  onClose: () => void;
  onDelete: () => void;
};

export const ProjectSettingsForm = ({ project, workspaceId, teams, onSaved, onClose, onDelete }: Props) => {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [owner, setOwner] = useState(project.owner?.id ?? '');
  const [status, setStatus] = useState(project.status);
  const [color, setColor] = useState<string | null>(project.color ?? null);
  const [targetDate, setTargetDate] = useState(project.target_date ?? '');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateProject = useUpdateProject(workspaceId);
  const deleteProject = useDeleteProject(workspaceId);

  useEffect(() => {
    setName(project.name);
    setDescription(project.description);
    setOwner(project.owner?.id ?? '');
    setStatus(project.status);
    setColor(project.color ?? null);
    setTargetDate(project.target_date ?? '');
    setError('');
  }, [project]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required');
      return;
    }
    setError('');
    updateProject.mutate(
      {
        projectId: project.public_id,
        data: {
          name: trimmed,
          description: description.trim(),
          owner: owner || null,
          status,
          color,
          target_date: targetDate || null
        }
      },
      {
        onSuccess: () => onSaved(),
        onError: err => {
          setError(err instanceof ApiError ? err.message : 'Something went wrong');
        }
      }
    );
  };

  const handleDelete = () => {
    setConfirmDelete(true);
  };

  const doDelete = () => {
    setConfirmDelete(false);
    deleteProject.mutate(project.id, {
      onSuccess: () => {
        onDelete();
        onSaved();
      },
      onError: err => {
        setError(err instanceof ApiError ? err.message : 'Something went wrong');
      }
    });
  };

  return (
    <Dialog open={true} onClose={onClose} title="Edit project">
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Name</label>
        <input className={styles.formInput} value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Description</label>
        <textarea
          className={`${styles.formInput} ${styles.formTextarea}`}
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Status</label>
        <select
          className={styles.formInput}
          value={status}
          onChange={e => setStatus(e.target.value as 'draft' | 'active' | 'complete' | 'cancelled')}
        >
          {PROJECT_STATUSES.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Owner</label>
        <select className={styles.formInput} value={owner} onChange={e => setOwner(e.target.value)}>
          <option value="">No owner</option>
          {teams.map(team => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Color</label>
        <ColorPicker value={color} onChange={setColor} size="small" />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Target date</label>
        <input
          className={styles.formInput}
          type="date"
          value={targetDate}
          onChange={e => setTargetDate(e.target.value)}
        />
      </div>
      {error && <div style={{ fontSize: 12, color: 'var(--error-fg)' }}>{error}</div>}
      <div className={styles.formActions}>
        <Button variant="danger" icon={<TbTrash size={12} />} onClick={handleDelete}>
          Delete project
        </Button>
        <div className={styles.formSpacer} />
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSave} disabled={updateProject.isPending}>
          {updateProject.isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>

      <DeleteConfirmationDialog
        open={confirmDelete}
        title="Delete project?"
        message={
          <>
            The project <b>{project.name}</b> and all its diagrams will be permanently deleted.
          </>
        }
        detail="This can't be undone."
        confirmLabel="Delete project"
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </Dialog>
  );
};
