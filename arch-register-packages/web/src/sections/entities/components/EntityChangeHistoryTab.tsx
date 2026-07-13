import { useMemo, useState } from 'react';
import type { EntityRecord, EntitySnapshot } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import { useAuditLog } from '../../../hooks/useAudit';
import { useRestoreSnapshot } from '../../../hooks/useSnapshots';
import { formatDateTime } from '../../../utils/dateFormat';
import { RestoreSnapshotDialog } from './RestoreSnapshotDialog';
import styles from './EntityChangeHistoryTab.module.css';
import sharedStyles from '../EntityDetailScreen.module.css';
import { Table } from '../../../components/table/Table';
import { DropdownMenu } from '../../../components/DropdownMenu';
import { EmptyState } from '../../../components/EmptyState';

type Props = {
  workspaceId: string;
  entityId: string;
  entity: EntityRecord | null;
  schema: EntitySchema | null;
  snapshots: EntitySnapshot[];
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  canViewAudit: boolean;
};

export const EntityChangeHistoryTab = ({
  workspaceId,
  entityId,
  entity,
  schema,
  snapshots,
  lifecycleStates,
  teams,
  canViewAudit
}: Props) => {
  const auditEntityId = entity?._uid ?? null;
  const { isLoading: loadingAudit } = useAuditLog(
    workspaceId,
    { entityId: auditEntityId, limit: 100 },
    { enabled: canViewAudit && !!auditEntityId }
  );
  const restoreSnapshot = useRestoreSnapshot(workspaceId, entityId);

  const [restoreDialogSnapshot, setRestoreDialogSnapshot] = useState<EntitySnapshot | null>(null);

  const savedSnapshots = useMemo(
    () =>
      snapshots.filter(
        s => s.status === 'autosave' || s.status === 'saved_version' || s.status === 'applied'
      ),
    [snapshots]
  );

  const handleRestore = async (commitMessage?: string) => {
    if (restoreDialogSnapshot) {
      try {
        await restoreSnapshot.mutateAsync({ snapshotId: restoreDialogSnapshot.id, commitMessage });
        setRestoreDialogSnapshot(null);
      } catch {
        // keep dialog open so the user can retry
      }
    }
  };

  if (loadingAudit) {
    return <div className={sharedStyles.loading}>Loading change history...</div>;
  }

  if (savedSnapshots.length === 0) {
    return (
      <EmptyState
        title="No change history yet"
        subtitle="Changes will appear here as properties are edited."
      />
    );
  }

  return (
    <>
      <div className={styles.changeHistory}>
        {savedSnapshots.length > 0 && (
          <Table.Root>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Date</Table.HeaderCell>
                <Table.HeaderCell>Type</Table.HeaderCell>
                <Table.HeaderCell>By</Table.HeaderCell>
                <Table.HeaderCell>Message</Table.HeaderCell>
                <Table.HeaderCell />
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {savedSnapshots.map(snapshot => (
                <Table.Row key={snapshot.id}>
                  <Table.Cell className={styles.chDim}>
                    {formatDateTime(snapshot.created_at)}
                  </Table.Cell>
                  <Table.Cell>
                    <span
                      className={`${styles.snapshotTypeBadge} ${snapshot.status !== 'autosave' ? styles.snapshotTypeBadgeSaved : ''}`}
                    >
                      {snapshot.status === 'saved_version'
                        ? 'saved'
                        : snapshot.status === 'applied'
                          ? 'applied'
                          : 'autosave'}
                    </span>
                  </Table.Cell>
                  <Table.Cell>{snapshot.created_by_name ?? '—'}</Table.Cell>
                  <Table.Cell className={styles.chDim}>{snapshot.commit_message ?? '—'}</Table.Cell>
                  <Table.ActionsCell>
                    {snapshot.status !== 'future_update' && (
                      <DropdownMenu
                        trigger={<Table.DotsButton />}
                        items={[
                          { label: 'Restore', onClick: () => setRestoreDialogSnapshot(snapshot) }
                        ]}
                      />
                    )}
                  </Table.ActionsCell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}
      </div>

      {restoreDialogSnapshot && entity && (
        <RestoreSnapshotDialog
          isOpen={true}
          onClose={() => setRestoreDialogSnapshot(null)}
          onConfirm={handleRestore}
          snapshot={restoreDialogSnapshot}
          currentState={{
            name: entity._name,
            description: entity._description,
            lifecycle: entity._lifecycle?.id ?? null,
            target_lifecycle: entity._targetLifecycle?.id ?? null,
            target_lifecycle_date: entity._targetLifecycleDate,
            owner: entity._owner?.id ?? null,
            data: schema ? Object.fromEntries(schema.fields.map(f => [f.id, entity[f.id]])) : {}
          }}
          schema={schema}
          lifecycleStates={lifecycleStates}
          teams={teams}
          isRestoring={restoreSnapshot.isPending}
        />
      )}
    </>
  );
};
