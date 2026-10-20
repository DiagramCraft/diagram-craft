import { useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import type { ChangeRow } from './entityTimelineHelpers';
import styles from './RestoreSnapshotDialog.module.css';
import { formatDateTime } from '../../../utils/dateFormat';
import { Table } from '../../../components/table/Table';

type RestoreSnapshotDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (commitMessage?: string) => void;
  version: {
    created_at: string;
    created_by_name: string | null;
    commit_message: string | null;
  };
  changes: ChangeRow[];
  isRestoring: boolean;
  subject?: 'entity' | 'relation';
};

export const RestoreSnapshotDialog = ({
  isOpen,
  onClose,
  onConfirm,
  version,
  changes,
  isRestoring,
  subject = 'entity'
}: RestoreSnapshotDialogProps) => {
  const [commitMessage, setCommitMessage] = useState('');

  const handleConfirm = () => {
    onConfirm(commitMessage ?? undefined);
  };

  return (
    <Dialog open={isOpen} onClose={onClose} title={`Restore ${subject === 'entity' ? 'Entity' : 'Relation'} Version`}>
      <div className={styles.content}>
        <div className={styles.warning}>
          <strong>Warning:</strong> This will restore the {subject} to a previous state. The current
          state will be saved as an autosave snapshot.
        </div>

        <div className={styles.snapshotInfo}>
          <div className={styles.infoRow}>
            <span className={styles.label}>Snapshot Date:</span>
            <span>{formatDateTime(version.created_at)}</span>
          </div>
          {version.created_by_name && (
            <div className={styles.infoRow}>
              <span className={styles.label}>Created By:</span>
              <span>{version.created_by_name}</span>
            </div>
          )}
          {version.commit_message && (
            <div className={styles.infoRow}>
              <span className={styles.label}>Message:</span>
              <span>{version.commit_message}</span>
            </div>
          )}
        </div>

        {changes.length > 0 && (
          <div className={styles.changes}>
            <h4>Changes that will be applied:</h4>
            <Table.Root>
              <Table.Head>
                <Table.Row>
                  <Table.HeaderCell>Field</Table.HeaderCell>
                  <Table.HeaderCell>Current Value</Table.HeaderCell>
                  <Table.HeaderCell>Restored Value</Table.HeaderCell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {changes.map((change, idx) => (
                  <Table.Row key={idx}>
                    <Table.Cell className={styles.fieldName}>{change.label}</Table.Cell>
                    <Table.Cell className={styles.oldValue}>{change.from}</Table.Cell>
                    <Table.Cell className={styles.newValue}>{change.to}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </div>
        )}

        <FormElement label="Commit Message" required={false}>
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
