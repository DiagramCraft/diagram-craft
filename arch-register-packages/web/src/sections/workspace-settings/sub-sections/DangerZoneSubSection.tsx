import { useState, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import styles from './DangerZoneSubSection.module.css';
import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { useDeleteWorkspace } from '../../../hooks/useWorkspaces';
import { Workspace } from '@arch-register/api-types/workspaceContract';

export const DangerZoneSubSection = ({ workspace }: { workspace: Workspace }) => {
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState('');

  const deleteWorkspaceMutation = useDeleteWorkspace();

  const canDelete = confirm === workspace.name;

  const handleDelete = useCallback(async () => {
    if (!canDelete) return;
    try {
      await deleteWorkspaceMutation.mutateAsync(workspace.id);
      navigate({ to: '/' });
    } catch {
      // Error handling could be improved
    }
  }, [workspace.id, canDelete, deleteWorkspaceMutation, navigate]);

  return (
    <div className={styles.blockList}>
      <div className={styles.dangerCard}>
        <div className={styles.dangerCardBody}>
          <div className={styles.dangerCardTitle}>Delete workspace permanently</div>
          <div className={styles.dangerCardText}>
            This will permanently erase <strong>{workspace.name}</strong> — every project, entity,
            diagram and integration. This cannot be undone.
          </div>
          <div className={styles.dangerCardControls}>
            <div className={styles.fieldLabel}>Type the workspace name to confirm</div>
            <TextInput
              placeholder={workspace.name}
              value={confirm}
              onChange={value => setConfirm(value ?? '')}
              style={{ maxWidth: 320, fontFamily: 'var(--mono)' }}
            />
          </div>
        </div>
        <div className={styles.dangerCardActions}>
          <Button
            variant="danger"
            disabled={!canDelete || deleteWorkspaceMutation.isPending}
            onClick={handleDelete}
          >
            {deleteWorkspaceMutation.isPending ? 'Deleting...' : 'Delete workspace'}
          </Button>
        </div>
      </div>
    </div>
  );
};
