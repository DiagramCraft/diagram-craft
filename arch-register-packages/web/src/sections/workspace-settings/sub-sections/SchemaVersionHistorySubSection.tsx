import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useSchemaPublications } from '../../../hooks/useSchemaDraft';
import { summarizeFieldChanges } from './fieldChangeSummary';
import { RollbackButton, type RollbackTarget } from './RollbackButton';
import { VersionHistoryList } from './VersionHistoryList';

type VersionEntryLike = {
  version: number;
  createdAt: string;
  changeSummary: Record<string, unknown>;
  publicationId?: string | null;
};

export const SchemaVersionHistorySubSection = ({
  versions,
  isLoading,
  rollback
}: {
  versions: VersionEntryLike[] | undefined;
  isLoading: boolean;
  /** When set, each version offers staging a rollback draft for this item. */
  rollback?: RollbackTarget;
}) => {
  const { workspaceSlug } = useWorkspaceContext();
  const { data: publications } = useSchemaPublications(workspaceSlug);
  const latestVersion = Math.max(0, ...(versions ?? []).map(v => v.version));
  const publicationsById = new Map((publications ?? []).map(p => [p.id, p]));

  return (
    <VersionHistoryList
      isLoading={isLoading}
      emptySubtitle="Changes to this schema will show up here."
      entries={versions?.map(version => {
        const publication = version.publicationId
          ? publicationsById.get(version.publicationId)
          : undefined;
        return {
          version: version.version,
          createdAt: version.createdAt,
          lines: [
            ...(publication ? [publication.summary] : []),
            summarizeFieldChanges(version.changeSummary)
          ],
          action: rollback ? (
            <RollbackButton
              target={rollback}
              version={version.version}
              isLatest={version.version === latestVersion}
            />
          ) : undefined
        };
      })}
    />
  );
};
