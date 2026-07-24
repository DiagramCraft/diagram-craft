import { useSchemaVersions } from '../../../hooks/useSchemas';
import { formatRelativeTime } from '../../../utils/dateFormat';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { TbHistory } from 'react-icons/tb';

const summarizeChange = (changeSummary: Record<string, unknown>): string => {
  const parts: string[] = [];
  const added = changeSummary.added as string[] | undefined;
  const removed = changeSummary.removed as string[] | undefined;
  const renamed = changeSummary.renamed as Array<{ from: string; to: string }> | undefined;
  const archived = changeSummary.archived as string[] | undefined;

  if (added?.length) parts.push(`Added ${added.join(', ')}`);
  if (removed?.length) parts.push(`Removed ${removed.join(', ')}`);
  if (renamed?.length) {
    parts.push(`Renamed ${renamed.map(r => `${r.from} → ${r.to}`).join(', ')}`);
  }
  if (archived?.length) parts.push(`Archived ${archived.join(', ')}`);

  return parts.length > 0 ? parts.join(' · ') : 'No field changes';
};

export const SchemaVersionHistorySubSection = ({
  workspaceId,
  schemaId
}: {
  workspaceId: string;
  schemaId: string;
}) => {
  const { data: versions, isLoading } = useSchemaVersions(workspaceId, schemaId);

  if (isLoading) return <LoadingState text="Loading version history..." />;

  if (!versions || versions.length === 0) {
    return (
      <EmptyState
        icon={<TbHistory size={22} />}
        title="No version history yet"
        subtitle="Changes to this schema will show up here."
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: 12, padding: '16px 0' }}>
      {versions.map(version => (
        <div
          key={version.version}
          style={{
            display: 'grid',
            gap: 4,
            padding: '12px 16px',
            border: '1px solid var(--cmp-border)',
            borderRadius: 6
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>Version {version.version}</span>
            <span className="dim">{formatRelativeTime(version.createdAt)}</span>
          </div>
          <div className="dim" style={{ fontSize: 12 }}>
            {summarizeChange(version.changeSummary)}
          </div>
        </div>
      ))}
    </div>
  );
};
