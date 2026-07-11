import { useMemo, useState } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
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
  const { data: auditLog = [], isLoading: loadingAudit } = useAuditLog(
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

  if (auditLog.length === 0 && savedSnapshots.length === 0) {
    return (
      <div className={sharedStyles.empty}>
        <div className={sharedStyles.emptyTitle}>No change history yet</div>
        <div>Changes will appear here as properties are edited.</div>
      </div>
    );
  }

  return (
    <>
      <div className={styles.changeHistory}>
        {savedSnapshots.length > 0 && (
          <div>
            <div className={styles.chTableWrap}>
              <table className={styles.chTable}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>By</th>
                    <th>Message</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {savedSnapshots.map(snapshot => (
                    <tr key={snapshot.id}>
                      <td className={styles.chDim}>{formatDateTime(snapshot.created_at)}</td>
                      <td>
                        <span
                          className={`${styles.snapshotTypeBadge} ${snapshot.status !== 'autosave' ? styles.snapshotTypeBadgeSaved : ''}`}
                        >
                          {snapshot.status === 'saved_version'
                            ? 'saved'
                            : snapshot.status === 'applied'
                              ? 'applied'
                              : 'autosave'}
                        </span>
                      </td>
                      <td>{snapshot.created_by_name ?? '—'}</td>
                      <td className={styles.chDim}>{snapshot.commit_message ?? '—'}</td>
                      <td className={styles.chActionsCell}>
                        {snapshot.status !== 'future_update' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setRestoreDialogSnapshot(snapshot)}
                          >
                            Restore
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
