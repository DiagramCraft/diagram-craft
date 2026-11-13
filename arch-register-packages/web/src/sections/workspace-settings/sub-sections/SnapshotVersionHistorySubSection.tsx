import type { SnapshotVersionKind } from '@arch-register/api-types/schemaDraftContract';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useSchemaPublications, useSnapshotVersions } from '../../../hooks/useSchemaDraft';
import { RollbackButton } from './RollbackButton';
import { VersionHistoryList } from './VersionHistoryList';

/** Version history of an enum, field group or category, which only exist as published snapshots. */
export const SnapshotVersionHistorySubSection = ({
  kind,
  itemId
}: {
  kind: SnapshotVersionKind;
  itemId: string;
}) => {
  const { workspaceSlug } = useWorkspaceContext();
  const { data: versions, isLoading } = useSnapshotVersions(workspaceSlug, kind, itemId);
  const { data: publications } = useSchemaPublications(workspaceSlug);
  const latestVersion = Math.max(0, ...(versions ?? []).map(v => v.version));
  const publicationsById = new Map((publications ?? []).map(p => [p.id, p]));

  return (
    <VersionHistoryList
      testId="snapshot-version-history"
      isLoading={isLoading}
      emptySubtitle="Changes to this item will show up here."
      entries={versions?.map(version => {
        const publication = version.publicationId
          ? publicationsById.get(version.publicationId)
          : undefined;
        return {
          version: version.version,
          createdAt: version.createdAt,
          lines: [publication?.summary ?? version.changeSummary ?? 'Direct change'],
          action: (
            <RollbackButton
              target={{ kind, itemId }}
              version={version.version}
              isLatest={version.version === latestVersion}
            />
          )
        };
      })}
    />
  );
};
