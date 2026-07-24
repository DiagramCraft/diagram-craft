import { useMemo, useState } from 'react';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntityVersion } from '@arch-register/api-types/entityVersionContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import { useAuditLog } from '../../../hooks/useAudit';
import { useRestoreEntityVersion } from '../../../hooks/useEntityVersions';
import { formatDateTime } from '../../../utils/dateFormat';
import { RestoreSnapshotDialog } from './RestoreSnapshotDialog';
import styles from './EntityChangeHistoryTab.module.css';
import { Table } from '../../../components/table/Table';
import { DropdownMenu } from '../../../components/DropdownMenu';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';

type Props = {
  workspaceId: string;
  entityId: string;
  entity: EntityRecord | null;
  schema: EntitySchema | null;
  versions: EntityVersion[];
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  canViewAudit: boolean;
};

const versionTypeLabel = (kind: EntityVersion['kind']): string =>
  kind === 'saved_version' ? 'saved' : kind === 'case_applied' ? 'applied' : 'autosave';

export const EntityChangeHistoryTab = ({
  workspaceId,
  entityId,
  entity,
  schema,
  versions,
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
  const restoreVersion = useRestoreEntityVersion(workspaceId, entityId);

  const [restoreDialogVersion, setRestoreDialogVersion] = useState<EntityVersion | null>(null);

  const savedVersions = useMemo(() => versions.filter(v => v.kind !== 'deleted'), [versions]);

  const handleRestore = async (commitMessage?: string) => {
    if (restoreDialogVersion) {
      try {
        await restoreVersion.mutateAsync({ versionId: restoreDialogVersion.id, commitMessage });
        setRestoreDialogVersion(null);
      } catch {
        // keep dialog open so the user can retry
      }
    }
  };

  if (loadingAudit) {
    return <LoadingState text="Loading change history..." size="sm" />;
  }

  if (savedVersions.length === 0) {
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
        {savedVersions.length > 0 && (
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
              {savedVersions.map(version => (
                <Table.Row key={version.id}>
                  <Table.Cell className={styles.chDim}>
                    {formatDateTime(version.created_at)}
                  </Table.Cell>
                  <Table.Cell>
                    <span
                      className={`${styles.snapshotTypeBadge} ${version.kind !== 'autosave' ? styles.snapshotTypeBadgeSaved : ''}`}
                    >
                      {versionTypeLabel(version.kind)}
                    </span>
                  </Table.Cell>
                  <Table.Cell>{version.created_by_name ?? '—'}</Table.Cell>
                  <Table.Cell className={styles.chDim}>{version.commit_message ?? '—'}</Table.Cell>
                  <Table.ActionsCell>
                    <DropdownMenu
                      trigger={<Table.DotsButton />}
                      items={[
                        { label: 'Restore', onClick: () => setRestoreDialogVersion(version) }
                      ]}
                    />
                  </Table.ActionsCell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}
      </div>

      {restoreDialogVersion && entity && (
        <RestoreSnapshotDialog
          isOpen={true}
          onClose={() => setRestoreDialogVersion(null)}
          onConfirm={handleRestore}
          version={restoreDialogVersion}
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
          isRestoring={restoreVersion.isPending}
        />
      )}
    </>
  );
};
