import { useMemo, useState } from 'react';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { RelationVersion } from '@arch-register/api-types/relationVersionContract';
import { DropdownMenu } from '../../components/DropdownMenu';
import { Table } from '../../components/table/Table';
import { useRelationVersions, useRestoreRelationVersion } from '../../hooks/useRelationVersions';
import { formatDateTime } from '../../utils/dateFormat';
import { diffRelationSnapshotState } from '../entities/components/entityTimelineHelpers';
import { RestoreSnapshotDialog } from '../entities/components/RestoreSnapshotDialog';
import { isRestorableRelationVersionKind, relationVersionTypeLabel } from './relationVersionsState';
import styles from './RelationHistorySection.module.css';

export const RelationHistorySection = ({
  workspaceSlug,
  relation,
  relationSchema
}: {
  workspaceSlug: string;
  relation: RelationRecord;
  relationSchema: RelationSchema | undefined;
}) => {
  const { data: versions = [] } = useRelationVersions(workspaceSlug, relation._uid, true);
  const restoreVersion = useRestoreRelationVersion(workspaceSlug, relation._uid);
  const [dialogVersion, setDialogVersion] = useState<RelationVersion | null>(null);

  const visibleVersions = useMemo(() => versions.filter(v => v.kind !== 'deleted'), [versions]);

  const handleRestore = async (commitMessage?: string) => {
    if (!dialogVersion) return;
    try {
      await restoreVersion.mutateAsync({ versionId: dialogVersion.id, commitMessage });
      setDialogVersion(null);
    } catch {
      // keep dialog open so the user can retry
    }
  };

  if (visibleVersions.length === 0) return <div className={styles.empty}>No history yet</div>;

  const fields = relationSchema?.fields ?? [];

  return (
    <>
      <Table.Root>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Date</Table.HeaderCell>
            <Table.HeaderCell>Type</Table.HeaderCell>
            <Table.HeaderCell>By</Table.HeaderCell>
            <Table.HeaderCell />
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {visibleVersions.map(version => (
            <Table.Row key={version.id}>
              <Table.Cell className={styles.dim}>{formatDateTime(version.created_at)}</Table.Cell>
              <Table.Cell>
                <span
                  className={`${styles.badge} ${version.kind !== 'autosave' ? styles.badgeSaved : ''}`}
                >
                  {relationVersionTypeLabel(version.kind)}
                </span>
              </Table.Cell>
              <Table.Cell>{version.created_by_name ?? '—'}</Table.Cell>
              <Table.ActionsCell>
                {relation.canEdit && isRestorableRelationVersionKind(version.kind) && (
                  <DropdownMenu
                    trigger={<Table.DotsButton />}
                    items={[{ label: 'Restore', onClick: () => setDialogVersion(version) }]}
                  />
                )}
              </Table.ActionsCell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>

      {dialogVersion && (
        <RestoreSnapshotDialog
          isOpen={true}
          onClose={() => setDialogVersion(null)}
          onConfirm={handleRestore}
          version={dialogVersion}
          changes={diffRelationSnapshotState(
            { data: Object.fromEntries(fields.map(f => [f.id, relation[f.id]])) },
            dialogVersion.state,
            relationSchema ?? null
          )}
          isRestoring={restoreVersion.isPending}
          subject="relation"
        />
      )}
    </>
  );
};
