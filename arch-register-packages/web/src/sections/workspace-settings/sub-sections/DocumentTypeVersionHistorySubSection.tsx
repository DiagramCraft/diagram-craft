import { useDocumentTypeVersions } from '../../../hooks/useDocuments';
import { useSchemaPublications } from '../../../hooks/useSchemaDraft';
import { summarizeFieldChanges } from './fieldChangeSummary';
import { RollbackButton } from './RollbackButton';
import { VersionHistoryList } from './VersionHistoryList';

export const DocumentTypeVersionHistorySubSection = ({
  workspaceId,
  documentTypeId
}: {
  workspaceId: string;
  documentTypeId: string;
}) => {
  const { data: versions, isLoading } = useDocumentTypeVersions(workspaceId, documentTypeId);
  const { data: publications } = useSchemaPublications(workspaceId);
  const latestVersion = Math.max(0, ...(versions ?? []).map(v => v.version));
  const publicationsById = new Map((publications ?? []).map(p => [p.id, p]));

  return (
    <VersionHistoryList
      isLoading={isLoading}
      emptySubtitle="Changes to this document type will show up here."
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
          action: (
            <RollbackButton
              target={{ kind: 'document_type', itemId: documentTypeId }}
              version={version.version}
              isLatest={version.version === latestVersion}
            />
          )
        };
      })}
    />
  );
};
