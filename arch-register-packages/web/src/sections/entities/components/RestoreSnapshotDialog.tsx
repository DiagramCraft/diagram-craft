import { useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import type { EntitySnapshot } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import { diffSnapshotState } from '../EntityTimelineTab';
import styles from './RestoreSnapshotDialog.module.css';

type RestoreSnapshotDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (commitMessage?: string) => void;
  snapshot: EntitySnapshot;
  currentState: Record<string, unknown>;
  schema: EntitySchema | null;
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  isRestoring: boolean;
};

export const RestoreSnapshotDialog = ({
  isOpen,
  onClose,
  onConfirm,
  snapshot,
  currentState,
  schema,
  lifecycleStates,
  teams,
  isRestoring
}: RestoreSnapshotDialogProps) => {
  const [commitMessage, setCommitMessage] = useState('');

  const changes = diffSnapshotState(
    currentState,
    snapshot.base_state,
    schema,
    lifecycleStates,
    teams
  );

  const handleConfirm = () => {
    onConfirm(commitMessage || undefined);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title="Restore Entity Version"
    >
      <div className={styles.content}>
        <div className={styles.warning}>
          <strong>Warning:</strong> This will restore the entity to a previous state. The current
          state will be saved as an autosave snapshot.
        </div>

        <div className={styles.snapshotInfo}>
          <div className={styles.infoRow}>
            <span className={styles.label}>Snapshot Date:</span>
            <span>{formatDate(snapshot.created_at)}</span>
          </div>
          {snapshot.created_by_name && (
            <div className={styles.infoRow}>
              <span className={styles.label}>Created By:</span>
              <span>{snapshot.created_by_name}</span>
            </div>
          )}
          {snapshot.commit_message && (
            <div className={styles.infoRow}>
              <span className={styles.label}>Message:</span>
              <span>{snapshot.commit_message}</span>
            </div>
          )}
        </div>

        {changes.length > 0 && (
          <div className={styles.changes}>
            <h4>Changes that will be applied:</h4>
            <table className={styles.changesTable}>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Current Value</th>
                  <th>Restored Value</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((change, idx) => (
                  <tr key={idx}>
                    <td className={styles.fieldName}>{change.label}</td>
                    <td className={styles.oldValue}>{change.from}</td>
                    <td className={styles.newValue}>{change.to}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <FormElement label="Commit Message (Optional)">
          <TextInput
            value={commitMessage}
            onChange={v => setCommitMessage(v ?? '')}
            placeholder="Describe why you're restoring this version..."
          />
        </FormElement>
      </div>

      <div className={styles.actions}>
        <Button variant="secondary" onClick={onClose} disabled={isRestoring} size="sm">
          Cancel
        </Button>
        <Button variant="primary" onClick={handleConfirm} disabled={isRestoring} size="sm">
          {isRestoring ? 'Restoring...' : 'Restore Version'}
        </Button>
      </div>
    </Dialog>
  );
};
