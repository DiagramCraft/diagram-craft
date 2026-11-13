import { TbHistory } from 'react-icons/tb';
import { Chip } from '../../../components/Chip';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useSchemaPublications } from '../../../hooks/useSchemaDraft';
import { formatRelativeTime } from '../../../utils/dateFormat';

const KIND_LABELS: Record<string, string> = {
  entity_schema: 'Entity type',
  relation_schema: 'Relation type',
  document_type: 'Document type',
  enum: 'Enum',
  field_group: 'Field group',
  category: 'Category'
};

const OP_LABELS = { create: 'New', update: 'Changed', delete: 'Deleted' } as const;

/** Lists published schema drafts, newest first, with what each one changed. */
export const PublicationHistorySubSection = () => {
  const { workspaceSlug } = useWorkspaceContext();
  const { data: publications, isLoading } = useSchemaPublications(workspaceSlug);

  if (isLoading) return <LoadingState text="Loading publication history..." />;

  if (!publications || publications.length === 0) {
    return (
      <EmptyState
        icon={<TbHistory size={22} />}
        title="Nothing published yet"
        subtitle="Published schema drafts will show up here."
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: 12 }} data-testid="publication-history">
      {publications.map(publication => (
        <div
          key={publication.id}
          style={{
            display: 'grid',
            gap: 6,
            padding: '12px 16px',
            border: '1px solid var(--cmp-border)',
            borderRadius: 6
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>
              #{publication.number} {publication.summary}
            </span>
            <span className="dim">{formatRelativeTime(publication.publishedAt)}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 12 }}>
            {publication.items.map(item => (
              <Chip key={`${item.kind}:${item.itemId}`}>
                {OP_LABELS[item.op]} {KIND_LABELS[item.kind] ?? item.kind}
                {item.name ? `: ${item.name}` : ''}
              </Chip>
            ))}
          </div>
          {publication.migrationDetails.length > 0 && (
            <div className="dim" style={{ fontSize: 12 }}>
              Migrations:{' '}
              {publication.migrationDetails
                .map(m => `${m.name} (${m.changes.length} field changes)`)
                .join(', ')}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
